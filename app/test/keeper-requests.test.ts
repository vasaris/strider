// Cross-consumer Keeper-request gate (3.1-C7): the APP's production Keeper factory sends the
// same bytes the evals full cycle does. For each of the 11 suite seeds the turn is captured as
// evals' captureTurn does it (initial state with eyeGap; replay stepsBefore; then the next turn),
// run through keeperFactory with a recording fake LlmClient, and compared with
// evals/test/fixtures/keeper-requests.v0.3.json: `user` byte-identical, `system` sha256 + UTF-8
// byte length equal. The fixture is read as JSON DATA -- app never imports evals.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { journeyTurn, type JourneyTurn } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';

import { KEEPER_PROMPT, keeperFactory } from '../src/server/service/keeper';
import { FakeLlm, ENV, REPO } from './support/service';
import { SEEDS, seedInitialState, type SuiteSeed } from './support/suiteSeeds';

const fixture = JSON.parse(readFileSync(join(REPO, 'evals', 'test', 'fixtures', 'keeper-requests.v0.3.json'), 'utf8')) as {
  readonly keeperPrompt: string;
  readonly system: { readonly sha256: string; readonly utf8Bytes: number };
  readonly users: Record<string, string>;
};

function captureTurn(seed: SuiteSeed): JourneyTurn {
  let state = seedInitialState(ENV, seed);
  for (let i = 0; i < (seed.stepsBefore ?? 0); i++) state = journeyTurn(state, ENV.cfg).next;
  return journeyTurn(state, ENV.cfg);
}

describe('app Keeper requests == evals fixture (keeper v0.3)', () => {
  it('the fixture names the prompt the app uses, and its users are the 11 seeds in order', () => {
    expect(fixture.keeperPrompt).toBe(KEEPER_PROMPT);
    expect(Object.keys(fixture.users)).toEqual(SEEDS.map((s) => s.id));
  });

  it('11/11: user byte-identical; system sha256 + UTF-8 bytes equal; one request per run', async () => {
    let matched = 0;
    for (const seed of SEEDS) {
      const llm = new FakeLlm();
      const keeper = keeperFactory({ repoRoot: () => REPO, llm: () => llm, model: () => 'm' })();
      await keeper.run(captureTurn(seed).pkg);
      expect(llm.calls).toHaveLength(1);
      const call = llm.calls[0]!;
      expect(call.user, seed.id).toBe(fixture.users[seed.id]);
      expect(createHash('sha256').update(call.system, 'utf8').digest('hex'), seed.id).toBe(fixture.system.sha256);
      expect(Buffer.byteLength(call.system, 'utf8'), seed.id).toBe(fixture.system.utf8Bytes);
      matched++;
    }
    expect(matched).toBe(11);
  });
});
