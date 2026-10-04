// The session service (3.1-C7; K4: live prose gate, turn resilience, session list): engine +
// Keeper + store behind five operations, pure orchestration over ports (ports.ts; no Next imports). Errors are ApiErrors with fixed public
// messages (http/errors.ts); internal messages never leave the server.
//
// Turn indices are 0-BASED and contiguous: a new session has nextTurnIndex 0; the state before
// turn n is turn n-1's stored state, or the session's initialState for n = 0. Every response
// that can be followed by a turn names nextTurnIndex.
//
// playTurn(id, n), in order:
//   key guard (503 keeper_not_configured, before anything else) -> Keeper setup, loaded once for
//   this request (503 keeper_not_configured; before any write) -> store (503 database_*) ->
//   session (404 session_not_found) -> P13 pack check (409 pack_mismatch) -> generation lock for
//   (id, n) (409 generation_in_progress; held to the end, released in finally) -> journey over
//   (409 journey_complete) -> index == nextTurnIndex (409 turn_conflict + nextTurnIndex) ->
//   engine step (422 unsupported_route, DZ1) -> atomic turn insert (a duplicate from another
//   process: 409 turn_conflict + the re-read nextTurnIndex) -> Keeper on the new package ->
//   U+0000 stripped -> gate -> generation row (prose, or the sanitized error) -> 201, or 502
//   keeper_failed with the turn saved, prose null.
//   Only P13 runs before the lock; the journey-over and index checks run inside it, so a
//   concurrent duplicate of the turn being created meets the lock: 409 generation_in_progress.
// regenerateProse(id, n): key guard -> Keeper setup -> store -> session (404) -> P13 (409) ->
//   turn n (404 turn_not_found) -> lock (409 generation_in_progress) -> Keeper on the STORED
//   package (the engine is not re-run) -> NUL strip -> gate -> generation row -> 201, or 502
//   keeper_failed.
// A generation row that cannot be written after a SUCCESSFUL Keeper call (API-RES1 (1)): the turn
// stays saved without a generation; 201 with prose null, proseState 'missing' (the code is
// logged, never the message).
//
// The prose gate (gate.ts) runs at write time AND at read time; the verdict is never stored (R3).
// The text of a blocked generation is never returned by any endpoint (F3).
//
// TurnView precedence (GET), per turn over its generations in creation order:
//   1. the LATEST generation whose prose passes the gate (no block finding) -> 'ready', that prose,
//      gate = its (warn) findings. A later failed or blocked generation never hides it.
//   2. else no generation at all -> 'missing', gate [].
//   3. else the latest generation is a Keeper error -> 'failed'; otherwise (its prose is blocked)
//      -> 'blocked'. prose null; gate = the findings of the latest BLOCKED generation (block + warn),
//      or [] when none was blocked.
// Every generation row carries the provenance of the setup that built its request (N1).
// The server never persists client-supplied state, packages or provenance (C7-2): the client
// gives a region, a session id and a turn index; everything else is computed here.
import 'server-only';

import type { JourneyState } from '@brodyazhnik/engine';
import {
  isJourneyOver,
  JourneyOverError,
  PREGEN_HERO_REF,
  startJourney,
  UnsupportedRouteError,
  type JourneyEnv,
  type JourneyRegion,
  type JourneyTurn,
  type NarrativePackage,
} from '@brodyazhnik/orchestrator';

import { ApiError } from '../http/errors';
import {
  TurnConflictError,
  type GenerationRecord,
  type SessionRecord,
  type SessionStore,
  type TurnRecord,
} from '../store/types';
import { gateProse, stripNul, type GateFinding } from './gate';
import { keeperErrorText } from './keeper';
import { labelsFor, type Labels } from './labels';
import type { KeeperRunner, ServiceDeps } from './ports';

/** The session list length (GET /api/sessions). */
export const RECENT_SESSIONS_LIMIT = 20;

export const REGIONS: readonly JourneyRegion[] = ['border_lands', 'wild_lands', 'dark_lands'];

export const isRegion = (v: unknown): v is JourneyRegion => typeof v === 'string' && (REGIONS as readonly string[]).includes(v);

export interface SessionView {
  readonly id: string;
  readonly createdAt: string;
  readonly rngSeed: string;
  readonly heroRef: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly region: JourneyRegion;
}

export interface CreatedSession {
  readonly session: SessionView;
  readonly nextTurnIndex: 0;
  readonly journeyComplete: false;
}

/** 'ready' prose shown | 'blocked' latest prose blocked by the gate | 'failed' latest generation is a
 *  Keeper error | 'missing' no generation (see the precedence in the header). */
export type ProseState = 'ready' | 'blocked' | 'failed' | 'missing';

export interface TurnView {
  readonly turnIndex: number;
  readonly createdAt: string;
  readonly pkg: NarrativePackage;
  readonly prose: string | null; // the latest ACCEPTED generation's prose, else null
  readonly proseState: ProseState;
  readonly gate: readonly GateFinding[];
  readonly generating: boolean; // the generation lock is held for this turn
  readonly generations: number;
}

export interface SessionDetail {
  readonly session: SessionView;
  readonly turns: readonly TurnView[];
  readonly labels: Labels; // labels for the ids the turns' packages show and the session region (labels.ts)
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
  readonly packCurrent: boolean; // false: turns are refused with 409 pack_mismatch (P13)
}

export interface SessionSummary {
  readonly session: SessionView;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

export interface SessionList {
  readonly sessions: readonly SessionSummary[];
}

/** The outcome of THIS request's generation: 'ready' (accepted), 'blocked', or 'missing' (the
 *  generation row could not be written; generationId null). */
export type WrittenProseState = Exclude<ProseState, 'failed'>;

export interface PlayedTurn {
  readonly turnIndex: number;
  readonly pkg: NarrativePackage;
  readonly labels: Labels;
  readonly prose: string | null;
  readonly proseState: WrittenProseState;
  readonly gate: readonly GateFinding[];
  readonly generationId: string | null;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

export interface RegeneratedProse {
  readonly turnIndex: number;
  readonly prose: string | null;
  readonly proseState: WrittenProseState;
  readonly gate: readonly GateFinding[];
  readonly generationId: string | null;
}

/** One generation as the gate sees it (never leaves the service with blocked text). */
type Generated =
  | { readonly kind: 'prose'; readonly id: string | null; readonly prose: string; readonly blocked: boolean; readonly findings: readonly GateFinding[] }
  | { readonly kind: 'error' };

const view = (s: SessionRecord): SessionView => ({
  id: s.id,
  createdAt: s.createdAt,
  rngSeed: s.rngSeed,
  heroRef: s.heroRef,
  packId: s.packId,
  packVersion: s.packVersion,
  region: s.initialState.journey.route.region,
});

const packCurrent = (s: SessionRecord, env: JourneyEnv): boolean => s.packId === env.packId && s.packVersion === env.packVersion;

/** The response fields of this request's generation (blocked text never included). */
function written(g: Extract<Generated, { kind: 'prose' }>): { prose: string | null; proseState: WrittenProseState; gate: readonly GateFinding[]; generationId: string | null } {
  if (g.id === null) return { prose: null, proseState: 'missing', gate: [], generationId: null };
  return g.blocked
    ? { prose: null, proseState: 'blocked', gate: g.findings, generationId: g.id }
    : { prose: g.prose, proseState: 'ready', gate: g.findings, generationId: g.id };
}

/** The state the next turn starts from and that turn's index. */
async function head(store: SessionStore, s: SessionRecord): Promise<{ state: JourneyState; nextTurnIndex: number }> {
  const latest = await store.latestTurn(s.id);
  return latest === null
    ? { state: s.initialState, nextTurnIndex: 0 }
    : { state: latest.state, nextTurnIndex: latest.turnIndex + 1 };
}

export class SessionService {
  constructor(private readonly deps: ServiceDeps) {}

  async createSession(region: unknown): Promise<CreatedSession> {
    if (!isRegion(region)) throw new ApiError('invalid_request');
    const route = this.deps.routeFor(region);
    if (route.dangerZones.length > 0) throw new ApiError('unsupported_route'); // DZ1
    const store = await this.deps.store();
    const env = this.deps.env();
    const rngSeed = this.deps.newSeed();
    const initialState = startJourney(env.cfg, { rngSeed, region, route });
    const rec = await store.createSession({
      rngSeed,
      heroRef: PREGEN_HERO_REF,
      packId: env.packId,
      packVersion: env.packVersion,
      initialState,
    });
    return { session: view(rec), nextTurnIndex: 0, journeyComplete: false };
  }

  async getSession(id: string): Promise<SessionDetail> {
    const store = await this.deps.store();
    const s = await this.session(store, id);
    const env = this.deps.env();
    const turns = await store.listTurns(s.id);
    const views: TurnView[] = [];
    for (const t of turns) views.push(this.turnView(s.id, t, await store.listGenerations(s.id, t.turnIndex)));
    const last = turns[turns.length - 1];
    const state = last === undefined ? s.initialState : last.state;
    return {
      session: view(s),
      turns: views,
      labels: labelsFor(this.deps.labels(), turns.map((t) => t.pkg), [s.initialState.journey.route.region]),
      nextTurnIndex: last === undefined ? 0 : last.turnIndex + 1,
      journeyComplete: isJourneyOver(state),
      packCurrent: packCurrent(s, env),
    };
  }

  /** The 20 most recent sessions (GET /api/sessions). */
  async listSessions(): Promise<SessionList> {
    const store = await this.deps.store();
    const recent = await store.listRecentSessions(RECENT_SESSIONS_LIMIT);
    return {
      sessions: recent.map(({ session, latestTurn }) => ({
        session: view(session),
        nextTurnIndex: latestTurn === null ? 0 : latestTurn.turnIndex + 1,
        journeyComplete: isJourneyOver(latestTurn === null ? session.initialState : latestTurn.state),
      })),
    };
  }

  async playTurn(id: string, turnIndex: number): Promise<PlayedTurn> {
    const keeper = this.keeper();
    const store = await this.deps.store();
    const s = await this.session(store, id);
    const env = this.deps.env();
    if (!packCurrent(s, env)) throw new ApiError('pack_mismatch'); // P13
    return this.locked(s.id, turnIndex, () => this.playLocked(store, keeper, s, env, turnIndex));
  }

  private async playLocked(store: SessionStore, keeper: KeeperRunner, s: SessionRecord, env: JourneyEnv, turnIndex: number): Promise<PlayedTurn> {
    const { state, nextTurnIndex } = await head(store, s);
    if (isJourneyOver(state)) throw new ApiError('journey_complete');
    if (turnIndex !== nextTurnIndex) throw new ApiError('turn_conflict', { nextTurnIndex });

    let t: JourneyTurn;
    try {
      t = this.deps.step(state, env.cfg);
    } catch (err) {
      if (err instanceof UnsupportedRouteError) throw new ApiError('unsupported_route');
      if (err instanceof JourneyOverError) throw new ApiError('journey_complete');
      throw err;
    }

    try {
      await store.appendTurn({ sessionId: s.id, turnIndex, state: t.next, pkg: t.pkg, packVersion: env.packVersion });
    } catch (err) {
      if (err instanceof TurnConflictError) {
        throw new ApiError('turn_conflict', { nextTurnIndex: (await head(store, s)).nextTurnIndex });
      }
      throw err;
    }

    const after = { turnIndex, nextTurnIndex: turnIndex + 1, journeyComplete: isJourneyOver(t.next) };
    const gen = await this.generate(store, keeper, s.id, turnIndex, t.pkg, 'turn');
    if (gen.kind === 'error') throw new ApiError('keeper_failed', { ...after, pkg: t.pkg });
    return {
      turnIndex,
      pkg: t.pkg,
      labels: labelsFor(this.deps.labels(), [t.pkg], [s.initialState.journey.route.region]),
      ...written(gen),
      nextTurnIndex: after.nextTurnIndex,
      journeyComplete: after.journeyComplete,
    };
  }

  async regenerateProse(id: string, turnIndex: number): Promise<RegeneratedProse> {
    const keeper = this.keeper();
    const store = await this.deps.store();
    const s = await this.session(store, id);
    if (!packCurrent(s, this.deps.env())) throw new ApiError('pack_mismatch'); // P13
    const turn = await store.getTurn(s.id, turnIndex);
    if (turn === null) throw new ApiError('turn_not_found');
    return this.locked(s.id, turnIndex, async () => {
      const gen = await this.generate(store, keeper, s.id, turnIndex, turn.pkg, 'prose');
      if (gen.kind === 'error') throw new ApiError('keeper_failed', { turnIndex });
      return { turnIndex, ...written(gen) };
    });
  }

  /** Run `fn` holding the generation lock of (sessionId, turnIndex); 409 when it is held. */
  private async locked<T>(sessionId: string, turnIndex: number, fn: () => Promise<T>): Promise<T> {
    const lock = this.deps.lock;
    if (!lock.tryAcquire(sessionId, turnIndex)) throw new ApiError('generation_in_progress');
    try {
      return await fn();
    } finally {
      lock.release(sessionId, turnIndex);
    }
  }

  /** The read-time view of one turn (precedence: see the header). */
  private turnView(sessionId: string, t: TurnRecord, gens: readonly GenerationRecord[]): TurnView {
    const vk = this.deps.vk();
    const judged: Generated[] = gens.map((g) =>
      g.prose === null ? { kind: 'error' } : { kind: 'prose', id: g.id, prose: g.prose, ...gateProse(g.prose, vk, t.pkg) },
    );
    const base = { turnIndex: t.turnIndex, createdAt: t.createdAt, pkg: t.pkg, generating: this.deps.lock.isHeld(sessionId, t.turnIndex), generations: gens.length };
    const accepted = latestProse(judged, false);
    if (accepted !== undefined) return { ...base, prose: accepted.prose, proseState: 'ready', gate: accepted.findings };
    const latest = judged[judged.length - 1];
    if (latest === undefined) return { ...base, prose: null, proseState: 'missing', gate: [] };
    const gate = latestProse(judged, true)?.findings ?? [];
    return { ...base, prose: null, proseState: latest.kind === 'error' ? 'failed' : 'blocked', gate };
  }

  /** Key guard, then this request's Keeper (one setup load). */
  private keeper(): KeeperRunner {
    if (!this.deps.keyPresent()) throw new ApiError('keeper_not_configured');
    try {
      return this.deps.keeper();
    } catch (err) {
      console.error(`keeper: keeper_not_configured (setup failed: ${err instanceof Error ? err.name : typeof err})`);
      throw new ApiError('keeper_not_configured');
    }
  }

  private async session(store: SessionStore, id: string): Promise<SessionRecord> {
    const s = await store.getSession(id);
    if (s === null) throw new ApiError('session_not_found');
    return s;
  }

  /**
   * One Keeper call and its generation row (prose with U+0000 stripped, or the sanitized error),
   * with provenance; the prose is gated against the turn's package. A Keeper error is returned as
   * { kind: 'error' } whether or not its row was written (the caller answers 502). When the row of
   * a SUCCESSFUL call cannot be written, the result carries id null (the caller answers 'missing').
   */
  private async generate(
    store: SessionStore,
    keeper: KeeperRunner,
    sessionId: string,
    turnIndex: number,
    pkg: NarrativePackage,
    where: string,
  ): Promise<Generated> {
    let prose: string;
    try {
      prose = stripNul(await keeper.run(pkg));
    } catch (err) {
      console.error(`${where}: keeper_failed (${err instanceof Error ? err.name : typeof err})`);
      const error = keeperErrorText(err, this.deps.secrets());
      try {
        await store.appendGeneration({ sessionId, turnIndex, ...keeper.provenance, prose: null, error });
      } catch (writeErr) {
        console.error(`${where}: generation_not_saved (${errorCode(writeErr)})`);
      }
      return { kind: 'error' };
    }
    const v = gateProse(prose, this.deps.vk(), pkg);
    try {
      const rec = await store.appendGeneration({ sessionId, turnIndex, ...keeper.provenance, prose, error: null });
      return { kind: 'prose', id: rec.id, prose, ...v };
    } catch (writeErr) {
      console.error(`${where}: generation_not_saved (${errorCode(writeErr)})`);
      return { kind: 'prose', id: null, prose, ...v };
    }
  }
}

type GatedProse = Extract<Generated, { kind: 'prose' }>;

/** The latest generation with prose whose gate verdict is `blocked`. */
function latestProse(judged: readonly Generated[], blocked: boolean): GatedProse | undefined {
  for (let i = judged.length - 1; i >= 0; i--) {
    const g = judged[i];
    if (g !== undefined && g.kind === 'prose' && g.blocked === blocked) return g;
  }
  return undefined;
}

/** A thrown value's code for a log line: its string `code` (store / driver), else its class name. */
function errorCode(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(code)) return code;
  return err instanceof Error ? err.name : typeof err;
}
