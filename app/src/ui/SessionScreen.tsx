'use client';

// The session screen /s/[id] (K5): header, the feed of turns (oldest first), the action bar.
// Data flow: GET /api/sessions/:id is the single source of truth -- after ANY POST the client
// re-GETs and never merges POST bodies into state. While a turn is generating (the server's
// lock, e.g. after a reload) or this client's own POST is in flight, GET is polled every 3 s:
// a setTimeout chain re-decided after EVERY attempt, success or failure (a failed poll keeps the
// last good detail, shows a quiet notice and is retried; see pollDelay in model.ts).
// No automatic retries: a failed or blocked prose waits for "Переписать". Accepted prose of the
// latest turn can be rewritten too (a quiet control); when that new version is not accepted the
// GET keeps the previous text, and a quiet notice says so (rewriteNotice in model.ts).
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';

import type { PlayedTurnDto, RegeneratedProseDto, SessionDetailDto } from '../shared/api';
import { apiGet, apiPost } from './api-client';
import { canAdvance, days, errorMessage, isQuietConflict, journeyDaysTotal, labelOf, pollDelay, rewriteNotice, turnsCount, type ClientErrorCode } from './model';
import { TurnCard } from './TurnCard';

type Busy = { readonly kind: 'turn' } | { readonly kind: 'prose'; readonly turnIndex: number } | null;

function SeedCopy({ seed }: { seed: string }): ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="seed">
      <code className="mono">{seed}</code>
      <button type="button" className="btn btn-tiny" onClick={copy} aria-label="Скопировать сид">
        {copied ? 'скопировано' : 'копировать'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Сид скопирован' : ''}
      </span>
    </span>
  );
}

export function SessionScreen({ id }: { id: string }): ReactElement {
  const [detail, setDetail] = useState<SessionDetailDto | null>(null);
  const [loadError, setLoadError] = useState<ClientErrorCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [pollError, setPollError] = useState<string | null>(null); // the last GET failed (cleared by a good one)
  const [attempts, setAttempts] = useState(0); // bumped after every GET, so the poll chain re-arms on failure too
  const seq = useRef(0); // GET responses older than the latest request applied are dropped
  const initialTurns = useRef<number | null>(null);
  const lastCount = useRef(0);
  const loaded = useRef(false);

  const base = `/api/sessions/${encodeURIComponent(id)}`;

  const refresh = useCallback(async (): Promise<void> => {
    const mine = ++seq.current;
    const r = await apiGet<SessionDetailDto>(base);
    setAttempts((n) => n + 1);
    if (mine !== seq.current) return;
    if (r.ok) {
      if (initialTurns.current === null) initialTurns.current = r.data.turns.length;
      loaded.current = true;
      setDetail(r.data);
      setLoadError(null);
      setPollError(null);
    } else if (!loaded.current) {
      setLoadError(r.code);
    } else {
      setPollError(errorMessage(r.code, null)); // keep the last good detail (a GET never fails with a keeper code)
    }
  }, [base]);

  // first load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // polling: one timer at a time, re-decided after every GET attempt (attempts) and on busy changes;
  // the cleanup clears it on re-arm, unmount and session change
  useEffect(() => {
    const delay = pollDelay(detail, busy !== null);
    if (delay === null) return;
    const t = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(t);
  }, [detail, busy, attempts, refresh]);

  // a turn that appeared after the first load scrolls into view
  useEffect(() => {
    const n = detail?.turns.length ?? 0;
    if (initialTurns.current !== null && n > lastCount.current && n > initialTurns.current) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelector(`[data-turn="${n - 1}"]`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    lastCount.current = n;
  }, [detail]);

  const afterPost = async (r: { ok: true } | { ok: false; code: ClientErrorCode }): Promise<void> => {
    await refresh();
    if (r.ok) return;
    const labels = detail?.labels ?? null; // names the keeper (every labels object carries the roles)
    if (isQuietConflict(r.code)) setNotice(errorMessage(r.code, labels));
    else setError(errorMessage(r.code, labels));
  };

  const advance = async (): Promise<void> => {
    if (detail === null || !canAdvance(detail, busy !== null)) return;
    setError(null);
    setNotice(null);
    setBusy({ kind: 'turn' });
    try {
      const r = await apiPost<PlayedTurnDto>(`${base}/turns`, { turnIndex: detail.nextTurnIndex });
      await afterPost(r);
    } finally {
      setBusy(null);
    }
  };

  const rewrite = async (turnIndex: number): Promise<void> => {
    if (busy !== null) return;
    setError(null);
    setNotice(null);
    setBusy({ kind: 'prose', turnIndex });
    const wasReady = detail?.turns.find((t) => t.turnIndex === turnIndex)?.proseState === 'ready';
    try {
      const r = await apiPost<RegeneratedProseDto>(`${base}/turns/${turnIndex}/prose`, {});
      await afterPost(r);
      const note = r.ok ? rewriteNotice(wasReady, r.data.proseState) : null;
      if (note !== null) setNotice(note);
    } finally {
      setBusy(null);
    }
  };

  if (detail === null) {
    return (
      <main className="page">
        <p className="back">
          <Link href="/">К списку сессий</Link>
        </p>
        {loadError !== null ? (
          <p className="alert" role="alert">
            {errorMessage(loadError, null)}
          </p>
        ) : (
          <p className="dim" role="status">
            Загрузка…
          </p>
        )}
      </main>
    );
  }

  const { session, turns, labels } = detail;
  const anyGenerating = turns.some((t) => t.generating);
  const actionsDisabled = busy !== null || anyGenerating || !detail.packCurrent;
  const totalDays = journeyDaysTotal(turns);
  const fresh = initialTurns.current ?? turns.length;
  const lastIndex = turns[turns.length - 1]?.turnIndex ?? null;
  const region = labelOf(labels, 'regions', session.region);

  return (
    <main className="page">
      <p className="back">
        <Link href="/">К списку сессий</Link>
      </p>

      <header className="session-head">
        <h1>
          Сессия <span className={region === session.region ? 'mono region' : 'region'}>{region}</span>
        </h1>
        <dl className="meta">
          <div>
            <dt>сид</dt>
            <dd>
              <SeedCopy seed={session.rngSeed} />
            </dd>
          </div>
          <div>
            <dt>пакет</dt>
            <dd className="mono">
              {session.packId} {session.packVersion}
            </dd>
          </div>
        </dl>
      </header>

      {!detail.packCurrent ? (
        <p className="banner" role="status">
          Сессия начата на другой версии пакета контента ({session.packVersion}). Читать её можно, продолжать нельзя.
        </p>
      ) : null}

      <section className="feed" aria-label="Лента ходов">
        {turns.length === 0 ? <p className="dim empty">Путь ещё не начат.</p> : null}
        {turns.map((t) => (
          <TurnCard
            key={t.turnIndex}
            turn={t}
            labels={labels}
            latest={t.turnIndex === lastIndex}
            pending={busy?.kind === 'prose' && busy.turnIndex === t.turnIndex}
            actionsDisabled={actionsDisabled}
            animate={t.turnIndex >= fresh}
            onRewrite={(n) => void rewrite(n)}
          />
        ))}
      </section>

      <div className="status-lines" aria-live="polite">
        {notice !== null ? <p className="notice">{notice}</p> : null}
        {pollError !== null ? <p className="notice">{pollError} Повторим через несколько секунд.</p> : null}
        {error !== null ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {detail.journeyComplete ? (
        <section className="final" aria-label="Путь окончен">
          <h2>Путь окончен</h2>
          <p>
            {totalDays !== null ? `Всего в пути: ${days(totalDays)}. ` : ''}
            {turnsCount(turns.length)} в ленте.
          </p>
          <Link href="/" className="btn btn-primary">
            Новая сессия
          </Link>
        </section>
      ) : (
        <nav className="action-bar" aria-label="Действия">
          <button type="button" className="btn btn-primary" onClick={() => void advance()} disabled={!canAdvance(detail, busy !== null)}>
            {busy?.kind === 'turn' ? 'В пути…' : 'Дальше в путь'}
          </button>
          {anyGenerating && busy === null ? <span className="dim">Ждём текст хода…</span> : null}
        </nav>
      )}
    </main>
  );
}
