// Test deps for the session service and handlers: the REAL pack env, journeyTurn, pregenRoute and
// the app's keeperFactory over a fake LlmClient that records every request and can be told to
// fail; a deterministic seed sequence; any SessionStore.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { journeyTurn, loadJourneyEnv, pregenRoute, type LlmClient, type LlmRequest } from '@brodyazhnik/orchestrator';

import type { ServiceDeps } from '../../src/server/service/ports';
import { keeperFactory } from '../../src/server/service/keeper';
import type { SessionStore } from '../../src/server/store/types';

export const REPO = fileURLToPath(new URL('../../..', import.meta.url));
export const ENV = loadJourneyEnv(join(REPO, 'content-packs', 'kv'));
export const TEST_MODEL = 'claude-test-model';
export const FAKE_SECRET = 'sk-ant-FAKE-test-secret-0123456789';

/** Records every request. `fail`: the next calls reject with that error; `replies`: canned prose. */
export class FakeLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  fail: Error | null = null;
  private n = 0;
  async complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    await Promise.resolve();
    if (this.fail !== null) throw this.fail;
    this.n++;
    return `  The wind smelled of rain (${this.n}).  `;
  }
}

export interface TestDeps extends ServiceDeps {
  readonly llm: FakeLlm;
  readonly seeds: string[];
  keeperLoads: number;
}

export function testDeps(store: SessionStore | (() => Promise<SessionStore>), over: Partial<ServiceDeps> = {}): TestDeps {
  const llm = new FakeLlm();
  const seeds: string[] = [];
  const queue = ['a3-3', 'a3-1', 'a3-12', 'a3-0', 'a3-7'];
  const factory = keeperFactory({ repoRoot: () => REPO, llm: () => llm, model: () => TEST_MODEL });
  const deps: TestDeps = {
    llm,
    seeds,
    keeperLoads: 0,
    keyPresent: () => true,
    keeper: () => {
      deps.keeperLoads++;
      return factory();
    },
    store: typeof store === 'function' ? store : async () => store,
    env: () => ENV,
    newSeed: () => {
      const s = queue[seeds.length % queue.length] ?? 'a3-3';
      seeds.push(s);
      return s;
    },
    routeFor: pregenRoute,
    step: journeyTurn,
    secrets: () => [FAKE_SECRET],
    ...over,
  };
  return deps;
}
