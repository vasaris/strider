// Test deps for the session service and handlers: the REAL pack env, VK addendum and label
// catalog, journeyTurn, pregenRoute and the app's keeperFactory over a fake LlmClient that records
// every request and can be told to fail or to reply with canned prose; a deterministic seed
// sequence; a fresh in-process generation lock; any SessionStore.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPack, nodePackSource } from '@brodyazhnik/engine';
import { journeyTurn, loadJourneyEnv, pregenRoute, type LlmClient, type LlmRequest } from '@brodyazhnik/orchestrator';
import { loadVkAddendumFromPack } from '@brodyazhnik/prose-gate';

import type { ServiceDeps } from '../../src/server/service/ports';
import { keeperFactory } from '../../src/server/service/keeper';
import { packLabels } from '../../src/server/service/labels';
import { InProcessGenerationLock } from '../../src/server/service/lock';
import type { SessionStore } from '../../src/server/store/types';

export const REPO = fileURLToPath(new URL('../../..', import.meta.url));
export const PACK_DIR = join(REPO, 'content-packs', 'kv');
export const ENV = loadJourneyEnv(PACK_DIR);
export const VK = loadVkAddendumFromPack(PACK_DIR);
export const LABELS = packLabels(loadPack(nodePackSource(PACK_DIR)));
/** A prose the gate blocks (a wrong-system calque) that also carries a warn (an English cliche). */
export const BLOCKED_PROSE = 'In that moment the wind dropped and the hero counted his \u0445\u0438\u0442\u044b.';
/** A prose the gate accepts with one warn finding. */
export const WARN_PROSE = 'In that moment the wind smelled of rain.';
export const TEST_MODEL = 'claude-test-model';
export const FAKE_SECRET = 'sk-ant-FAKE-test-secret-0123456789';

/** Records every request. `fail`: the next calls reject with that error; `replies`: canned prose,
 *  consumed first-in first-out (then the default numbered prose); `gate`: when set, each call
 *  waits for it before replying (to hold a generation in flight). */
export class FakeLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  fail: Error | null = null;
  readonly replies: string[] = [];
  gate: Promise<void> | null = null;
  private n = 0;
  async complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    await Promise.resolve();
    if (this.gate !== null) await this.gate;
    if (this.fail !== null) throw this.fail;
    this.n++;
    return this.replies.shift() ?? `  The wind smelled of rain (${this.n}).  `;
  }
}

export interface TestDeps extends ServiceDeps {
  readonly llm: FakeLlm;
  readonly seeds: string[];
  readonly lock: InProcessGenerationLock;
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
    vk: () => VK,
    labels: () => LABELS,
    lock: new InProcessGenerationLock(),
    ...over,
  } as TestDeps;
  return deps;
}
