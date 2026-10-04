'use client';

// The start screen "/" (K5): pick a region -> POST /api/sessions -> /s/[id]; below, the recent
// sessions (GET /api/sessions). Regions are shown by id: the pack has no structured region name,
// and the app writes no setting names of its own.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';

import type { CreatedSessionDto, RegionId, SessionListDto } from '../shared/api';
import { apiGet, apiPost } from './api-client';
import { errorMessage, formatDate, turnsCount, type ClientErrorCode } from './model';

export function HomeScreen({ regions }: { regions: readonly RegionId[] }): ReactElement {
  const router = useRouter();
  const [list, setList] = useState<SessionListDto | null>(null);
  const [listError, setListError] = useState<ClientErrorCode | null>(null);
  const [creating, setCreating] = useState<RegionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void apiGet<SessionListDto>('/api/sessions').then((r) => {
      if (!live) return;
      if (r.ok) setList(r.data);
      else setListError(r.code);
    });
    return () => {
      live = false;
    };
  }, []);

  const start = async (region: RegionId): Promise<void> => {
    if (creating !== null) return;
    setError(null);
    setCreating(region);
    const r = await apiPost<CreatedSessionDto>('/api/sessions', { region });
    if (r.ok) {
      router.push(`/s/${encodeURIComponent(r.data.session.id)}`);
      return; // keep the buttons disabled while navigating
    }
    setError(errorMessage(r.code));
    setCreating(null);
  };

  return (
    <main className="page">
      <header className="home-head">
        <svg viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" className="mark">
          <path
            fillRule="evenodd"
            d="M32 8.96 55.04 32 32 55.04 8.96 32Z M32 15.41 48.59 32 32 48.59 15.41 32Z M32 25.09 38.91 32 32 38.91 25.09 32Z"
          />
        </svg>
        <h1>Бродяжник</h1>
      </header>

      <section className="start" aria-labelledby="start-h">
        <h2 id="start-h">Новый путь</h2>
        <p className="dim">Выберите регион. Маршрут и герой готовы заранее.</p>
        <div className="regions">
          {regions.map((r) => (
            <button key={r} type="button" className="btn region-btn" onClick={() => void start(r)} disabled={creating !== null}>
              <span className="mono">{r}</span>
              <span className="dim small">{creating === r ? 'создаётся…' : 'начать'}</span>
            </button>
          ))}
        </div>
        {error !== null ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="recent" aria-labelledby="recent-h">
        <h2 id="recent-h">Недавние сессии</h2>
        {list === null && listError === null ? (
          <p className="dim" role="status">
            Загрузка…
          </p>
        ) : null}
        {listError !== null ? (
          <p className="alert" role="alert">
            {errorMessage(listError)}
          </p>
        ) : null}
        {list !== null && list.sessions.length === 0 ? <p className="dim">Сессий пока нет.</p> : null}
        {list !== null && list.sessions.length > 0 ? (
          <ul className="session-list">
            {list.sessions.map(({ session, nextTurnIndex, journeyComplete }) => (
              <li key={session.id}>
                <Link href={`/s/${encodeURIComponent(session.id)}`} className="session-link">
                  <span className="mono">{session.region}</span>
                  <span className="num">{turnsCount(nextTurnIndex)}</span>
                  <span className={journeyComplete ? 'state-done' : 'state-open'}>{journeyComplete ? 'путь окончен' : 'в пути'}</span>
                  <time dateTime={session.createdAt} className="dim">
                    {formatDate(session.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
