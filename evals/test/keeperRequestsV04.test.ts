// 3.3a-K4 byte-identity gate for the BEAT requests (keeper v0.4): keeper-requests.v0.4.json pins the
// Keeper request of every prose beat of the 11 SUITE_JOURNEYS played by the scripted player
// (src/harness/beatScript.ts; previous prose = PREVIOUS_PROSE_STUB on every first beat and every
// resolution). Offline: mock LlmClient, no key, no network. The v0.3 fixture and its test
// (keeperRequests.test.ts) stay untouched.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadVkAddendumFromPack, scanTurnProse } from '@brodyazhnik/prose-gate';
import {
  AnthropicKeeper,
  buildKeeperUser,
  loadJourneyEnv,
  loadKeeperSetup,
  type LlmClient,
  type LlmRequest,
} from '@brodyazhnik/orchestrator';
import {
  APPROACHES,
  HOPE,
  PREVIOUS_PROSE_STUB,
  QUESTIONS,
  playScriptedSuite,
  type ScriptedBeat,
} from '../src/harness/beatScript.js';
import { SUITE_JOURNEYS } from '../src/harness/suiteSeeds.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packRoot = resolve(repoRoot, 'content-packs/kv');
const env = loadJourneyEnv(packRoot);
const setup = loadKeeperSetup({ repoRoot, keeperPrompt: 'prompts/keeper.system.v0.4.md' });
const system = setup.system;
const toneMd = readFileSync(resolve(repoRoot, 'content-packs/kv/tone.md'), 'utf8');
const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/keeper-requests.v0.4.json');
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
  readonly streamCalls: LlmRequest[] = [];
  complete(req: LlmRequest): Promise<string> {
    this.calls.push(req);
    return Promise.resolve('Проза.');
  }
  stream(req: LlmRequest, onText: (d: string) => void): Promise<string> {
    this.streamCalls.push(req);
    onText('Проза.');
    return Promise.resolve('Проза.');
  }
}

let beats: ScriptedBeat[] = [];
beforeAll(async () => {
  beats = await playScriptedSuite(env);
});
const beat = (key: string): ScriptedBeat => {
  const b = beats.find((x) => x.key === key);
  if (b === undefined) throw new Error(`no beat ${key}`);
  return b;
};

describe('3.3a-K4 beat request fixture (keeper-requests.v0.4.json)', () => {
  it('the fixture keys are exactly the scripted prose beats, in play order', () => {
    expect(Object.keys(fixture.users)).toEqual(beats.map((b) => b.key));
    // Every suite journey contributes; setup+resolution except the arrival and the encounter.
    expect(beats).toHaveLength(SUITE_JOURNEYS.length * 2 - 2);
  });

  it('paths match, tone.md unchanged (toneSha256), system sha256 + UTF-8 bytes', () => {
    expect(fixture.keeperPrompt).toBe('prompts/keeper.system.v0.4.md');
    expect(fixture.tone).toBe('content-packs/kv/tone.md');
    expect(sha(toneMd)).toBe(fixture.toneSha256);
    expect(setup.provenance.tone.sha256).toBe(fixture.toneSha256);
    expect(setup.provenance.keeper.path).toBe(fixture.keeperPrompt);
    expect(sha(system)).toBe(fixture.system.sha256);
    expect(Buffer.byteLength(system, 'utf8')).toBe(fixture.system.utf8Bytes);
  });

  it('every user message is byte-identical to the fixture', () => {
    for (const b of beats) expect(buildKeeperUser(setup.assembly, b.pkg), b.key).toBe(fixture.users[b.key]);
  });

  it('the full request path: run() and runStream() each make one call with the fixture system/user', async () => {
    for (const b of beats) {
      const llm = new MockLlm();
      const keeper = new AnthropicKeeper({ llm, model: 'm', assembly: setup.assembly });
      await keeper.run({ systemPrompt: system, package: b.pkg });
      await keeper.runStream({ systemPrompt: system, package: b.pkg }, () => {});
      expect(llm.calls, b.key).toHaveLength(1);
      expect(llm.streamCalls, b.key).toHaveLength(1);
      for (const call of [llm.calls[0]!, llm.streamCalls[0]!]) {
        expect(sha(call.system)).toBe(fixture.system.sha256);
        expect(call.user).toBe(fixture.users[b.key]);
      }
    }
  });

  it('sanity: setup / resolution / arrival sections', () => {
    for (const [key, user] of Object.entries(fixture.users)) {
      const lines = user.split('\n');
      if (key.endsWith('.setup')) {
        expect(lines, key).toContain('beat: setup');
        expect(lines, key).not.toContain('## dice');
      }
      if (key.endsWith('.resolution')) {
        expect(lines, key).toContain('## dice');
        expect(lines, key).toContain('## previous');
        expect(user, key).not.toContain('travel_check');
      }
      expect(lines, key).toContain('## previous'); // every prose beat carries previous prose here
    }
    const arrival = fixture.users['j.border.arrival.arrival']!.split('\n');
    expect(arrival).toContain('beat: arrival');
    expect(arrival).toContain('arrived: true');
  });

  it('`## questions` appears in exactly the 3 scripted beats', () => {
    const withQuestions = Object.entries(fixture.users)
      .filter(([, u]) => u.split('\n').includes('## questions'))
      .map(([k]) => k);
    const expected = Object.entries(QUESTIONS).map(([id, q]) => `${id}.${q.when === 'before_travel' ? 'setup' : 'resolution'}`);
    expect(withQuestions.sort()).toEqual(expected.sort());
    for (const k of expected) expect(beat(k).questions).toHaveLength(1);
  });

  it('the two-line approach renders as a block scalar; at least two prose beats carry no approach', () => {
    const twoLine = APPROACHES.find((a) => a.includes('\n'))!;
    const carriers = beats.filter((b) => b.approach === twoLine);
    expect(carriers.length).toBeGreaterThan(0);
    for (const b of carriers) {
      expect(fixture.users[b.key], b.key).toContain(`approach: |\n${twoLine.split('\n').map((l) => `    ${l}`).join('\n')}\n`);
    }
    expect(beats.filter((b) => b.approach === null).length).toBeGreaterThanOrEqual(2);
  });

  it('the stub, approaches and questions pass scanTurnProse with no findings; stub <= 200 chars', () => {
    const vk = loadVkAddendumFromPack(packRoot);
    expect(PREVIOUS_PROSE_STUB.length).toBeLessThanOrEqual(200);
    for (const t of [PREVIOUS_PROSE_STUB, ...APPROACHES, ...Object.values(QUESTIONS).map((q) => q.question)]) {
      expect(scanTurnProse(t, vk, null), t).toEqual([]);
    }
  });
});

describe('3.3a-K4 script keeps the suite pins where it spends Hope or asks before travel', () => {
  const pinOf = (id: string) => SUITE_JOURNEYS.find((j) => j.id === id)!.journey.expect!;

  it('Hope rolls: the shortcut / inspiring scene checks still succeed, the arrival still arrives; hope_spent 1', () => {
    expect(Object.keys(HOPE).sort()).toEqual(['j.border.arrival', 'j.border.inspiring', 'j.border.shortcut']);
    for (const id of ['j.border.shortcut', 'j.border.inspiring']) {
      const setupBeat = beat(`${id}.setup`);
      const res = beat(`${id}.resolution`);
      expect(setupBeat.pkg.player?.hope_spent).toBe(0);
      expect(res.pkg.player?.hope_spent).toBe(1);
      expect(res.pkg.oracle?.result_ref).toBe(pinOf(id).sceneType);
      expect(res.pkg.oracle?.detail?.row?.face).toBe(pinOf(id).detailFace);
      expect(pinOf(id).sceneCheck).toBe('success');
      expect(res.pkg.dice?.outcome).not.toBe('failure');
    }
    const arrival = beat('j.border.arrival.arrival');
    expect(arrival.pkg.player?.hope_spent).toBe(1);
    expect(arrival.pkg.journey?.arrived).toBe(true);
    expect(arrival.pkg.journey?.days_total).toBe(8);
    // No Hope anywhere else.
    for (const b of beats) {
      const id = b.key.slice(0, b.key.lastIndexOf('.'));
      const spent = (HOPE[id] === 'travel' && b.beat !== 'resolution') || (HOPE[id] === 'check' && b.beat === 'resolution') ? 1 : 0;
      expect(b.pkg.player?.hope_spent, b.key).toBe(spent);
    }
  });

  it('j.dark.despair: the oracle roll before travel still lands on the pinned scene (a setup, not significant)', () => {
    const s = beat('j.dark.despair.setup');
    expect(s.questions).toHaveLength(1);
    expect(s.pkg.oracle?.result_ref).toBe(pinOf('j.dark.despair').sceneType);
    expect(s.pkg.oracle?.detail?.row?.significantEncounter).toBe(false);
  });
});
