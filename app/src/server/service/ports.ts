// The session service's ports (3.1-C7). Production wiring: deps.ts; tests pass their own.
import 'server-only';

import type { JourneyConfigs, JourneyState, Route } from '@brodyazhnik/engine';
import type { JourneyEnv, JourneyRegion, JourneyTurn, NarrativePackage } from '@brodyazhnik/orchestrator';

import type { KeeperProvenance, SessionStore } from '../store/types';

/** One Keeper, built from ONE loadKeeperSetup (N1): its provenance names exactly the bytes behind
 *  every request it sends. run() resolves to the prose or rejects with the model call's error. */
export interface KeeperRunner {
  readonly provenance: KeeperProvenance; // model + keeper prompt path/sha256 + tone/assembly sha256
  run(pkg: NarrativePackage): Promise<string>;
}

export interface ServiceDeps {
  /** True when the model key is present (production: non-empty ANTHROPIC_API_KEY). Never the key. */
  keyPresent(): boolean;
  /** A Keeper for this request; throws when the prompt / tone / assembly cannot be loaded. */
  keeper(): KeeperRunner;
  /** The store; rejects with an ApiError (database_*) when the database is not usable. */
  store(): Promise<SessionStore>;
  /** The journey environment over the verified pack (cfg, packId, packVersion). */
  env(): JourneyEnv;
  /** A fresh RNG seed for a new session (P10: 1..128 characters). */
  newSeed(): string;
  /** The route a new session in this region plays (production: pregenRoute). */
  routeFor(region: JourneyRegion): Route;
  /** One engine turn (production: journeyTurn). */
  step(state: JourneyState, cfg: JourneyConfigs): JourneyTurn;
  /** Values that must never be recorded (production: the key and connection strings). */
  secrets(): readonly string[];
}
