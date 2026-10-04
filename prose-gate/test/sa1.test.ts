// SA1 plural address (sa1.ts): authorial-text extraction, pronoun boundaries, thresholds, the
// package-only scope in scanTurnProse, and a corpus check over the recorded Keeper proses
// (evals/l4-records + evals/records, read as DATA with fs -- no evals code is imported). Offline.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NarrativePackage } from '@brodyazhnik/orchestrator';
import { describe, expect, it } from 'vitest';
import type { Violation } from '../src/antislop.js';
import { scanTurnProse } from '../src/grounding.js';
import { authorialText, scanPluralAddress } from '../src/sa1.js';
import { loadVkAddendumFromPack } from '../src/vkAddendum.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packRoot = resolve(repoRoot, 'content-packs/kv');
const PKG: NarrativePackage = { intent: 'journey', scene: 'journey', length_target: { min_chars: 400, max_chars: 800 } };

const sa1 = (prose: string): Violation[] => scanPluralAddress(prose);
const severities = (prose: string): string[] => sa1(prose).map((v) => v.severity);

describe('SA1 thresholds', () => {
  it('>= 2 plural pronouns -> one block finding', () => {
    const prose = 'Вы идёте по тропе. Ветер толкает вас в спину.';
    const v = sa1(prose);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ list: 'sa1_plural', term: 'Вы', severity: 'block', index: 0 });
    expect(v[0]?.reason).toContain('2 plural-address');
  });

  it('exactly 1 -> one warn finding at its offset', () => {
    const prose = 'Ты идёшь по тропе. Между вами и рекой — камыш.';
    expect(sa1(prose)).toEqual([
      expect.objectContaining({ list: 'sa1_plural', term: 'вами', severity: 'warn', index: prose.indexOf('вами') }),
    ]);
  });

  it('singular narration is clean', () => {
    expect(sa1('Ты идёшь по тропе. Ветер толкает тебя в спину, твой плащ мокнет.')).toEqual([]);
  });
});

describe('SA1 pronoun boundaries', () => {
  it.each(['выход', 'вывод', 'вязь', 'увы', 'выше', 'вамп', 'Васька'])('%s does not count', (w) => {
    expect(sa1(`Ты видишь ${w}.`)).toEqual([]);
  });

  it.each([
    ['Вас at sentence start', 'Тишина. Вас ждут.'],
    ['вашего', 'Ты не видишь вашего костра.'],
    ['ваша', 'Ты слышишь: ваша тропа кончилась.'],
    ['вам', 'Ты знаешь, что вам туда.'],
    ['ВЫ upper', 'ВЫ НЕ ПРОЙДЁТЕ, думаешь ты.'],
  ])('%s counts', (_label, prose) => {
    expect(severities(prose)).toEqual(['warn']);
  });

  it('punctuation is a boundary', () => {
    expect(severities('Ты замер: вы,вас')).toEqual(['block']);
  });
});

describe('SA1 authorial text', () => {
  it('strips «…», nested and multiline, keeping the length', () => {
    const prose = 'Он сказал: «Вы с ним «вас» не\nзнаете вашего». Ты молчишь.';
    const a = authorialText(prose);
    expect(a).toHaveLength(prose.length);
    expect(a).not.toMatch(/Вы|вас|вашего/u);
    expect(a).toContain('\n');
    expect(sa1(prose)).toEqual([]);
  });

  it('a stray » is ignored; an unclosed « hides the rest (a miss, never a false block)', () => {
    expect(severities('Вы» шли.')).toEqual(['warn']);
    expect(sa1('Ты шёл. «Вы куда? Вас ждут.')).toEqual([]);
  });

  it.each([
    ['em dash', '—'],
    ['en dash', '–'],
    ['hyphen', '-'],
  ])('strips dialogue lines starting with %s (after leading whitespace)', (_label, dash) => {
    const prose = `Ты стоишь у ворот.\n  ${dash} Вы кто такие? Вас не звали.\nТы молчишь.`;
    expect(sa1(prose)).toEqual([]);
  });

  it('a dash mid-line does not make it a dialogue line', () => {
    expect(severities('Ты стоишь — вы оба стоите, и вас видно.')).toEqual(['block']);
  });

  it('pronouns outside quotes still count, offsets are original', () => {
    const prose = '«Стой», — шепчет он. Вы замираете.';
    expect(sa1(prose)).toEqual([expect.objectContaining({ term: 'Вы', index: prose.indexOf('Вы'), severity: 'warn' })]);
  });

  it('LIMIT (a): authorial words inside a dialogue line are not seen', () => {
    expect(sa1('— Стой, — говорит он вам, и вы стоите.')).toEqual([]);
  });
});

describe('SA1 scope in scanTurnProse', () => {
  const prose = 'Вы идёте. Ветер толкает вас.';

  it('no package -> no sa1 at all (identical to scanProse)', () => {
    expect(scanTurnProse(prose, null, null).some((v) => v.list === 'sa1_plural')).toBe(false);
  });

  it('with a package -> sa1 after the NF1 buckets', () => {
    const lists = scanTurnProse(`Второй день. ${prose}`, null, PKG).map((v) => v.list);
    expect(lists).toEqual(['nf1_backstory', 'sa1_plural']);
  });
});

interface CorpusProse {
  readonly id: string;
  readonly prose: string;
  readonly pkg: NarrativePackage;
}

/** Every recorded Keeper prose: full-cycle-report.*.json in evals/l4-records and evals/records. */
function loadCorpus(): CorpusProse[] {
  const out: CorpusProse[] = [];
  for (const dir of ['evals/l4-records', 'evals/records']) {
    const abs = resolve(repoRoot, dir);
    for (const f of readdirSync(abs).filter((n) => n.startsWith('full-cycle-report.') && n.endsWith('.json')).sort()) {
      const json = JSON.parse(readFileSync(resolve(abs, f), 'utf8')) as {
        report: { transcripts: { scenarioId: string; package: NarrativePackage; output: { prose: string } }[] };
      };
      for (const t of json.report.transcripts) {
        out.push({ id: `${dir}/${f}#${t.scenarioId}`, prose: t.output.prose, pkg: t.package });
      }
    }
  }
  return out;
}

describe('SA1 corpus (recorded proses as data)', () => {
  const corpus = loadCorpus();
  const vk = loadVkAddendumFromPack(packRoot);
  const OPUS_31_MISHAP = 'evals/records/full-cycle-report.keeper-v0.3.judge-v0.4.claude-opus-4-8.20260927T223309Z.json#j.wild.mishap';
  const OPUS_01_SIGNIFICANT = 'evals/l4-records/full-cycle-report.v0.1.claude-opus-4-8.json#j.dark.significant';
  const SONNET_31_DETECTION = 'evals/records/full-cycle-report.keeper-v0.3.judge-v0.4.claude-sonnet-5.20260927T222434Z.json#j.dark.detection';

  it('reads all 58 proses (36 L4 + 22 3.1) -- a silently skipped file fails here', () => {
    expect(corpus).toHaveLength(58);
    expect(corpus.filter((c) => c.id.startsWith('evals/l4-records/'))).toHaveLength(36);
    expect(corpus.filter((c) => c.id.startsWith('evals/records/'))).toHaveLength(22);
  });

  it('SA1 fires exactly on the three known proses', () => {
    const fired = Object.fromEntries(
      corpus.flatMap((c) => scanPluralAddress(c.prose).map((v) => [c.id, `${v.severity}:${v.term}`] as const)),
    );
    expect(fired).toEqual({
      [OPUS_01_SIGNIFICANT]: 'warn:вами',
      [OPUS_31_MISHAP]: 'block:вы',
      [SONNET_31_DETECTION]: 'warn:вас',
    });
  });

  it('whole gate with each prose package: 5 blocked proses, 2 SA1 warns', () => {
    const blocked: Record<string, string[]> = {};
    let sa1Warns = 0;
    for (const c of corpus) {
      const v = scanTurnProse(c.prose, vk, c.pkg);
      const blocks = v.filter((x) => x.severity === 'block');
      if (blocks.length > 0) blocked[c.id] = blocks.map((x) => `${x.list}:${x.term}`);
      sa1Warns += v.filter((x) => x.list === 'sa1_plural' && x.severity === 'warn').length;
    }
    expect(blocked).toEqual({
      'evals/l4-records/full-cycle-report.v0.1.claude-opus-4-8.json#j.border.shortcut': ['mixed_script:papoротнике'],
      'evals/l4-records/full-cycle-report.v0.1.claude-opus-4-8.json#j.dark.misfortune': ['nf1_name:Пригорья'],
      'evals/l4-records/full-cycle-report.v0.3.claude-opus-4-8.json#j.wild.meeting': ['nf1_name:Пригорья'],
      [OPUS_31_MISHAP]: ['sa1_plural:вы'],
      'evals/records/full-cycle-report.keeper-v0.3.judge-v0.4.claude-sonnet-5.20260927T222434Z.json#j.dark.despair': [
        'mixed_script:palой',
      ],
    });
    expect(sa1Warns).toBe(2);
  });
});
