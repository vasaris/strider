// The session service (3.1-C7): engine + Keeper + store behind four operations, pure
// orchestration over ports (ports.ts; no Next imports). Errors are ApiErrors with fixed public
// messages (http/errors.ts); internal messages never leave the server.
//
// Turn indices are 0-BASED and contiguous: a new session has nextTurnIndex 0; the state before
// turn n is turn n-1's stored state, or the session's initialState for n = 0. Every response
// that can be followed by a turn names nextTurnIndex.
//
// playTurn(id, n), in order:
//   key guard (503 keeper_not_configured, before anything else) -> Keeper setup, loaded once for
//   this request (503 keeper_not_configured; before any write) -> store (503 database_*) ->
//   session (404 session_not_found) -> P13 pack check (409 pack_mismatch) -> journey over
//   (409 journey_complete) -> index == nextTurnIndex (409 turn_conflict + nextTurnIndex) ->
//   engine step (422 unsupported_route, DZ1) -> atomic turn insert (a concurrent duplicate:
//   409 turn_conflict + the re-read nextTurnIndex) -> Keeper on the new package -> generation row
//   (prose, or the sanitized error) -> 201, or 502 keeper_failed with the turn saved, prose null.
// regenerateProse(id, n): key guard -> Keeper setup -> store -> session (404) -> P13 (409) ->
//   turn n (404 turn_not_found) -> Keeper on the STORED package (the engine is not re-run) ->
//   generation row -> 201, or 502 keeper_failed.
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
} from '../store/types';
import { keeperErrorText } from './keeper';
import type { KeeperRunner, ServiceDeps } from './ports';

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

export interface TurnView {
  readonly turnIndex: number;
  readonly createdAt: string;
  readonly pkg: NarrativePackage;
  readonly prose: string | null; // the latest generation's prose (null: none yet, or it failed)
  readonly proseFailed: boolean; // the latest generation is an error
  readonly generations: number;
}

export interface SessionDetail {
  readonly session: SessionView;
  readonly turns: readonly TurnView[];
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
  readonly packCurrent: boolean; // false: turns are refused with 409 pack_mismatch (P13)
}

export interface PlayedTurn {
  readonly turnIndex: number;
  readonly pkg: NarrativePackage;
  readonly prose: string;
  readonly generationId: string;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

export interface RegeneratedProse {
  readonly turnIndex: number;
  readonly prose: string;
  readonly generationId: string;
}

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
    for (const t of turns) {
      const gens: GenerationRecord[] = await store.listGenerations(s.id, t.turnIndex);
      const last = gens[gens.length - 1];
      views.push({
        turnIndex: t.turnIndex,
        createdAt: t.createdAt,
        pkg: t.pkg,
        prose: last?.prose ?? null,
        proseFailed: last !== undefined && last.error !== null,
        generations: gens.length,
      });
    }
    const last = turns[turns.length - 1];
    const state = last === undefined ? s.initialState : last.state;
    return {
      session: view(s),
      turns: views,
      nextTurnIndex: last === undefined ? 0 : last.turnIndex + 1,
      journeyComplete: isJourneyOver(state),
      packCurrent: packCurrent(s, env),
    };
  }

  async playTurn(id: string, turnIndex: number): Promise<PlayedTurn> {
    const keeper = this.keeper();
    const store = await this.deps.store();
    const s = await this.session(store, id);
    const env = this.deps.env();
    if (!packCurrent(s, env)) throw new ApiError('pack_mismatch'); // P13
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
    if (gen.prose === null) throw new ApiError('keeper_failed', { ...after, pkg: t.pkg });
    return { turnIndex, pkg: t.pkg, prose: gen.prose, generationId: gen.id, nextTurnIndex: after.nextTurnIndex, journeyComplete: after.journeyComplete };
  }

  async regenerateProse(id: string, turnIndex: number): Promise<RegeneratedProse> {
    const keeper = this.keeper();
    const store = await this.deps.store();
    const s = await this.session(store, id);
    if (!packCurrent(s, this.deps.env())) throw new ApiError('pack_mismatch'); // P13
    const turn = await store.getTurn(s.id, turnIndex);
    if (turn === null) throw new ApiError('turn_not_found');
    const gen = await this.generate(store, keeper, s.id, turnIndex, turn.pkg, 'prose');
    if (gen.prose === null) throw new ApiError('keeper_failed', { turnIndex });
    return { turnIndex, prose: gen.prose, generationId: gen.id };
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

  /** One Keeper call and its generation row (prose, or the sanitized error), with provenance. */
  private async generate(
    store: SessionStore,
    keeper: KeeperRunner,
    sessionId: string,
    turnIndex: number,
    pkg: NarrativePackage,
    where: string,
  ): Promise<GenerationRecord> {
    let outcome: { prose: string; error: null } | { prose: null; error: string };
    try {
      outcome = { prose: await keeper.run(pkg), error: null };
    } catch (err) {
      console.error(`${where}: keeper_failed (${err instanceof Error ? err.name : typeof err})`);
      outcome = { prose: null, error: keeperErrorText(err, this.deps.secrets()) };
    }
    return store.appendGeneration({ sessionId, turnIndex, ...keeper.provenance, ...outcome });
  }
}
