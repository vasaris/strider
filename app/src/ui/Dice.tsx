// The dice panel (K5, 3.2.b): one d12 (face numbers, the eye at 11, the rune at 12) and the pool
// of d6. All glyphs are our own abstract drawings. Colour is never the only signal: the kept /
// dropped d12, the success icon and a voided d6 each carry a text or shape cue and an aria name.
import type { ReactElement } from 'react';

import { featAria, successAria, type DiceModel, type FeatGlyph, type SuccessDie } from './model';

const PENTAGON = '24,3.5 44.5,18.4 36.7,42.5 11.3,42.5 3.5,18.4';

function FeatFace({ glyph }: { glyph: FeatGlyph }): ReactElement {
  if (glyph.kind === 'eye') {
    return (
      <g className="glyph-eye">
        <path d="M11 25.5 C17 16.5 31 16.5 37 25.5 C31 34.5 17 34.5 11 25.5 Z" fill="none" strokeWidth="2.2" />
        <path d="M24 19 C26.6 22.5 26.6 28.5 24 32 C21.4 28.5 21.4 22.5 24 19 Z" stroke="none" />
      </g>
    );
  }
  if (glyph.kind === 'rune') {
    return (
      <g className="glyph-rune" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 13.5 V37" />
        <path d="M21 17 L30.5 22.5 L21 28" />
        <path d="M27.5 31.5 L31 37" />
      </g>
    );
  }
  return (
    <text x="24" y="25.5" textAnchor="middle" dominantBaseline="central" className="die-num">
      {glyph.face}
    </text>
  );
}

export function FeatDie({ glyph, state = 'plain', size = 52 }: { glyph: FeatGlyph; state?: 'plain' | 'kept' | 'dropped'; size?: number }): ReactElement {
  const label = featAria(glyph) + (state === 'kept' ? ', оставлена' : state === 'dropped' ? ', отброшена' : '');
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`die die-d12 die-${glyph.kind} die-${state}`}
    >
      <polygon points={PENTAGON} className="die-body" />
      <FeatFace glyph={glyph} />
    </svg>
  );
}

function Rhombus({ cx, cy, r, className }: { cx: number; cy: number; r: number; className?: string }): ReactElement {
  return <path d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`} className={className} />;
}

export function SuccessDieView({ die, size = 38 }: { die: SuccessDie; size?: number }): ReactElement {
  return (
    <svg
      role="img"
      aria-label={successAria(die)}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={`die die-d6${die.icon ? ' die-icon' : ''}${die.counted ? '' : ' die-void'}`}
    >
      <rect x="3" y="3" width="34" height="34" rx="7" className="die-body" />
      <text x="20" y="21" textAnchor="middle" dominantBaseline="central" className="die-num">
        {die.face}
      </text>
      {die.icon ? <Rhombus cx={31} cy={9} r={3.6} className="icon-mark" /> : null}
      {die.counted ? null : <path d="M8 32 L32 8" className="void-mark" />}
    </svg>
  );
}

/** The outcome mark: a filled rhombus for a success, an open crossed one for a failure. */
function OutcomeMark({ tone }: { tone: DiceModel['tone'] }): ReactElement | null {
  if (tone === 'neutral') return null;
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="outcome-mark">
      {tone === 'success' ? (
        <Rhombus cx={8} cy={8} r={6} />
      ) : (
        <>
          <Rhombus cx={8} cy={8} r={6} className="open" />
          <path d="M4.5 11.5 L11.5 4.5" className="open" />
        </>
      )}
    </svg>
  );
}

export function DicePanel({
  model,
  title,
  caption,
  animate = false,
}: {
  model: DiceModel;
  title: string;
  caption?: string | null;
  animate?: boolean;
}): ReactElement {
  const featEvent = model.feat?.kind === 'eye' ? ' event-eye' : model.feat?.kind === 'rune' ? ' event-rune' : '';
  return (
    <section className={`dice-panel tone-${model.tone}${featEvent}${animate ? ' animate' : ''}`} aria-label={title}>
      <header className="dice-head">
        <h4 className="dice-title">{title}</h4>
        {caption ? <p className="dice-caption">{caption}</p> : null}
      </header>

      <div className="dice-row">
        <div className="feat-group">
          {model.candidates.length > 0
            ? model.candidates.map((c, i) => <FeatDie key={i} glyph={c.glyph} state={c.kept ? 'kept' : 'dropped'} />)
            : model.feat !== null
              ? <FeatDie glyph={model.feat} />
              : null}
          {model.modifier !== null ? (
            <span className="modifier" title={model.modifier.id}>
              {model.modifier.label}
            </span>
          ) : null}
        </div>

        {model.success.length > 0 ? (
          <div className="pool" role="group" aria-label="Пул d6">
            {model.success.map((s, i) => (
              <SuccessDieView key={i} die={s} />
            ))}
          </div>
        ) : model.successIcons !== null && !model.hasFaces ? (
          <p className="icons-count">значков успеха: {model.successIcons}</p>
        ) : null}
      </div>

      <dl className="dice-figures">
        {model.total !== null ? (
          <div>
            <dt>сумма</dt>
            <dd className="num">{model.total}</dd>
          </div>
        ) : null}
        {model.tn !== null ? (
          <div>
            <dt>порог</dt>
            <dd className="num">{model.tn}</dd>
          </div>
        ) : null}
        {model.outcome !== null ? (
          <div className="outcome">
            <dt className="sr-only">исход</dt>
            <dd>
              <OutcomeMark tone={model.tone} />
              <span>{model.outcome.label}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
