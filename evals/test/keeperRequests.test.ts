// 3.1-C4 byte-identity gate rationale: evals/test/fixtures/keeper-requests.v0.3.json was captured
// on the CURRENT evals path (keeper v0.3 + live tone.md, buildKeeperSystem/buildKeeperUser,
// captureTurn over SUITE_JOURNEYS) BEFORE the Keeper seam moves into orchestrator at C4. That move
// must reproduce these exact bytes -- system prompt and every seed's user message -- without this
// fixture file changing. This test pins the fixture against the evals path so a drift here is
// caught before the seam moves, and doubles as the NF1 x TP1 seam check: name grounding through
// the new `## detection` / `## journey` sections the Keeper package now carries (3.1-C2/C3).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanTurnProse } from '../src/grounding.js';
import { AnthropicKeeper, buildKeeperUser } from '../src/harness/anthropicKeeper.js';
import { captureTurn, loadEngineEnv } from '../src/harness/engineProvider.js';
import { buildKeeperSystem } from '../src/harness/keeperSystem.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';
import type { LlmClient, LlmRequest } from '../src/harness/types.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = loadEngineEnv(resolve(repoRoot, 'content-packs/kv'));
const keeperPrompt = readFileSync(resolve(repoRoot, 'prompts/keeper.system.v0.3.md'), 'utf8');
const toneMd = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
const system = buildKeeperSystem(keeperPrompt, toneMd);

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/keeper-requests.v0.3.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  readonly note: string;
  readonly keeperPrompt: string;
  readonly tone: string;
  readonly toneSha256: string;
  readonly system: { readonly sha256: string; readonly utf8Bytes: number };
  readonly users: Record<string, string>;
};

class MockLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];
  constructor(private readonly reply: string) {}
  complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    return Promise.resolve(this.reply);
  }
}

describe('3.1-C4 byte-identity fixture (keeper-requests.v0.3.json)', () => {
  it('the fixture user keys are exactly the SUITE_JOURNEYS ids, in order', () => {
    expect(Object.keys(fixture.users)).toEqual(SUITE_JOURNEYS.map((j) => j.id));
  });

  it('the fixture paths match what this test reads, and tone.md is unchanged (toneSha256)', () => {
    expect(fixture.keeperPrompt).toBe('prompts/keeper.system.v0.3.md');
    expect(fixture.tone).toBe('content-packs/kv/tone.md');
    // Checked BEFORE the system-hash test below, so a tone.md edit fails here with a clear
    // "tone changed" message rather than an opaque system-sha256 mismatch.
    expect(createHash('sha256').update(toneMd, 'utf8').digest('hex')).toBe(fixture.toneSha256);
  });

  it('sha256 + UTF-8 byte length of buildKeeperSystem(v0.3, tone) equal the fixture', () => {
    expect(createHash('sha256').update(system, 'utf8').digest('hex')).toBe(fixture.system.sha256);
    expect(Buffer.byteLength(system, 'utf8')).toBe(fixture.system.utf8Bytes);
  });

  it('for every seed, buildKeeperUser(captureTurn(env, j.journey).pkg) equals the fixture user', () => {
    for (const j of SUITE_JOURNEYS) {
      const pkg = captureTurn(env, j.journey).pkg;
      expect(buildKeeperUser(pkg)).toBe(fixture.users[j.id]);
    }
  });

  it('the full request path: AnthropicKeeper sees exactly one call matching the fixture system/user', async () => {
    for (const j of SUITE_JOURNEYS) {
      const pkg = captureTurn(env, j.journey).pkg;
      const llm = new MockLlm('Проза.');
      const keeper = new AnthropicKeeper({ llm, model: 'm' });
      await keeper.run({ systemPrompt: system, package: pkg });
      expect(llm.calls).toHaveLength(1);
      const call = llm.calls[0]!;
      expect(createHash('sha256').update(call.system, 'utf8').digest('hex')).toBe(fixture.system.sha256);
      expect(call.user).toBe(fixture.users[j.id]);
    }
  });

  it('sanity: every fixture user contains `## journey`; `## detection` appears only in j.dark.detection', () => {
    for (const [id, user] of Object.entries(fixture.users)) {
      expect(user, id).toContain('## journey');
      if (id === 'j.dark.detection') {
        expect(user, id).toContain('## detection');
      } else {
        expect(user, id).not.toContain('## detection');
      }
    }
  });
});

describe('NF1 x TP1 seam (name grounding through ## detection / ## journey)', () => {
  it('j.dark.detection: a named threat grounded by the detection scene text is NOT blocked', () => {
    const pkg = captureTurn(env, SUITE_JOURNEYS.find((j) => j.id === 'j.dark.detection')!.journey).pkg;
    const prose = 'На гребне мелькнули тени: слуги Врага шли по следу.';
    const violations = scanTurnProse(prose, null, pkg);
    expect(violations.some((v) => v.list === 'nf1_name')).toBe(false);
  });

  it('j.dark.detection: the same prose WITHOUT the detection section BLOCKS on the ungrounded name', () => {
    const pkg = captureTurn(env, SUITE_JOURNEYS.find((j) => j.id === 'j.dark.detection')!.journey).pkg;
    const prose = 'На гребне мелькнули тени: слуги Врага шли по следу.';
    const violations = scanTurnProse(prose, null, { ...pkg, detection: null });
    expect(violations.some((v) => v.list === 'nf1_name' && v.term === 'Врага' && v.severity === 'block')).toBe(true);
  });

  it('j.border.arrival: the live package carries days_total 8, and exempts the ordinal day phrase', () => {
    const pkg = captureTurn(env, SUITE_JOURNEYS.find((j) => j.id === 'j.border.arrival')!.journey).pkg;
    expect(pkg.journey?.days_total).toBe(8);

    // Ordinal day phrase: no warn with the live (arrived) package, but a warn once journey is
    // stripped -- the day count no longer has a package source.
    expect(scanTurnProse('Восьмой день пути остался позади.', null, pkg).some((v) => v.list === 'nf1_backstory')).toBe(false);
    expect(
      scanTurnProse('Восьмой день пути остался позади.', null, { ...pkg, journey: null }).some((v) => v.list === 'nf1_backstory'),
    ).toBe(true);

    // Cardinal day count: outside the lexicon by construction, no warn either way.
    expect(scanTurnProse('Восемь дней пути остались позади.', null, pkg).some((v) => v.list === 'nf1_backstory')).toBe(false);
    expect(
      scanTurnProse('Восемь дней пути остались позади.', null, { ...pkg, journey: null }).some((v) => v.list === 'nf1_backstory'),
    ).toBe(false);

    // A mismatched ordinal (arrival is the 8th day, not the 3rd) still warns.
    expect(scanTurnProse('Третий день пути.', null, pkg).some((v) => v.list === 'nf1_backstory')).toBe(true);
  });

  it('j.border.shortcut: a non-arrival step still warns on the ordinal day phrase', () => {
    const pkg = captureTurn(env, SUITE_JOURNEYS.find((j) => j.id === 'j.border.shortcut')!.journey).pkg;
    expect(pkg.journey?.days_total).toBeUndefined();
    expect(scanTurnProse('Второй день дорога шла под гору.', null, pkg).some((v) => v.list === 'nf1_backstory')).toBe(true);
  });
});
