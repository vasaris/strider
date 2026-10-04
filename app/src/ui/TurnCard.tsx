// One turn of the feed (K5, 3.2.a/3.2.c): the mechanics inset (scene, detail row, detection, days,
// tracker deltas), the dice panel of both rolls (the scene check and, separately, the travel roll)
// and the prose area with its states. Rewrite controls (rewriteControl in model.ts): the F3 control
// of a blocked / failed / missing turn on any turn; a quiet one under accepted prose on the latest
// turn only.
import type { ReactElement } from 'react';

import type { LabelsDto, TurnDto } from '../shared/api';
import { DicePanel } from './Dice';
import { daysLine, gateReason, deltaRows, diceModel, keeperName, labelOf, rewriteControl, sceneOf, signed, turnUi, type TurnUi } from './model';

function Prose({
  ui,
  keeper,
  latest,
  onRewrite,
  disabled,
}: {
  ui: TurnUi;
  keeper: string; // the keeper's name (server label)
  latest: boolean;
  onRewrite: () => void;
  disabled: boolean;
}): ReactElement {
  const control = rewriteControl(ui, latest);
  switch (ui.kind) {
    case 'ready':
      return (
        <>
          <div className="prose-text">
            {ui.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {ui.rewriting ? <p className="prose-note">Пишется новый вариант…</p> : null}
          {ui.warnings.length > 0 ? (
            <details className="prose-warn">
              <summary>Замечания проверки: {ui.warnings.length}</summary>
              <ul>
                {ui.warnings.map((w, i) => (
                  <li key={i}>
                    «{w.term}» <span className="dim">{gateReason(w.list)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {control === 'quiet' ? (
            <button type="button" className="btn-link" onClick={onRewrite} disabled={disabled}>
              Переписать
            </button>
          ) : null}
        </>
      );
    case 'generating':
      return (
        <div className="prose-pending">
          <p className="prose-note">Пишется…</p>
          <div className="skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      );
    default: {
      const head =
        ui.kind === 'blocked' ? 'Текст скрыт: он не прошёл проверку.' : ui.kind === 'failed' ? `${keeper} не ответил.` : 'Текста для этого хода нет.';
      return (
        <div className="prose-problem">
          <p>{head}</p>
          {ui.kind === 'blocked' ? (
            <ul className="reasons">
              {ui.reasons.map((r, i) => (
                <li key={i}>
                  {r.sentence}
                  {r.terms.length > 0 ? <span className="terms"> {r.terms.map((t) => `«${t}»`).join(', ')}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {control === 'recover' ? (
            <button type="button" className="btn btn-quiet" onClick={onRewrite} disabled={disabled}>
              Переписать
            </button>
          ) : null}
        </div>
      );
    }
  }
}

export function TurnCard({
  turn,
  labels,
  latest,
  pending,
  actionsDisabled,
  animate,
  onRewrite,
}: {
  turn: TurnDto;
  labels: LabelsDto | null;
  latest: boolean; // the last turn of the feed (the quiet rewrite of accepted prose)
  pending: boolean;
  actionsDisabled: boolean;
  animate: boolean;
  onRewrite: (turnIndex: number) => void;
}): ReactElement {
  const { pkg } = turn;
  const scene = sceneOf(pkg, labels);
  const deltas = deltaRows(pkg.patch);
  const gained = pkg.patch?.conditions_gained ?? [];
  const cleared = pkg.patch?.conditions_cleared ?? [];
  const ui = turnUi(turn, pending);
  const headingId = `turn-${turn.turnIndex}`;

  return (
    <article className="turn" aria-labelledby={headingId} data-turn={turn.turnIndex}>
      <header className="turn-head">
        <h3 id={headingId}>
          <span className="turn-no num">Ход {turn.turnIndex + 1}</span>
          {scene.scene !== null ? <span className="turn-scene">{scene.scene}</span> : null}
        </h3>
      </header>

      <div className="mechanics">
        {scene.detail !== null || scene.prompt !== null ? (
          <p className="detail-row">
            {scene.detail !== null ? <span className="detail-scene">{scene.detail}</span> : null}
            {scene.prompt !== null ? <span className="detail-prompt">{scene.prompt}</span> : null}
          </p>
        ) : null}

        {pkg.detection != null ? (
          <div className="detection" role="note">
            <span className="tag tag-eye">обнаружение</span>
            <p>{pkg.detection.scene}</p>
          </div>
        ) : null}

        <div className="dice-pair">
          {pkg.dice != null ? (
            <DicePanel model={diceModel(pkg.dice, labels)} title="Проверка сцены" caption={scene.skill} animate={animate} />
          ) : null}
          {pkg.journey?.travel_check != null ? (
            <DicePanel
              model={diceModel(pkg.journey.travel_check, labels)}
              title="Бросок пути"
              caption="переход этого хода; не исход сцены"
              animate={animate}
            />
          ) : null}
        </div>

        {pkg.journey != null || deltas.length > 0 || gained.length > 0 || cleared.length > 0 ? (
          <ul className="facts">
            {pkg.journey != null ? <li className={pkg.journey.arrived === true ? 'fact-arrival' : undefined}>{daysLine(pkg.journey)}</li> : null}
            {deltas.map((d) => {
              const name = labelOf(labels, 'trackers', d.id);
              return (
                <li key={d.id}>
                  <span className={name === d.id ? 'mono' : undefined}>{name}</span> <span className="num">{signed(d.value)}</span>
                </li>
              );
            })}
            {gained.map((c) => (
              <li key={`g-${c}`}>+ {labelOf(labels, 'conditions', c)}</li>
            ))}
            {cleared.map((c) => (
              <li key={`c-${c}`}>
                <s>{labelOf(labels, 'conditions', c)}</s> снято
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="prose" aria-live="polite" aria-busy={ui.kind === 'generating'}>
        <Prose ui={ui} keeper={keeperName(labels)} latest={latest} onRewrite={() => onRewrite(turn.turnIndex)} disabled={actionsDisabled} />
      </div>
    </article>
  );
}
