import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Prompt-diff pin (A3.2). Mechanically enforces two things: v0 stays frozen, and v0.1 = v0 plus
// ONLY the reviewer-approved edits below. Each `old` must occur exactly once in v0; the edits are
// applied in order and the result must equal the v0.1 file byte-for-byte. Any other change to
// either file (or a new edit not listed here) fails this test. A4.2 adds the same pin one step up:
// v0.1 frozen by sha256, v0.2 = v0.1 + the approved edits.

const promptsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..', 'prompts');
const read = (name: string): string => readFileSync(resolve(promptsDir, name), 'utf8');

// Frozen v0 baselines (sha256 of the file bytes): keeper v0 = the prompt behind smoke K at
// e75b228; judge v0 = the June calibration run. Without this pin the same edit applied to v0
// AND v0.1 would pass the diff check below.
const V0_SHA256 = {
  'keeper.system.v0.md': 'f549eff4cb348f2c9c675ec7299a0c2eb26d232457d898f8f6f26d032da5124e',
  'judge.system.v0.md': '1e70b43b0e8b6ad86be6baa132f3ae48721dc538b02c65fd4f169fd8da3b6ca5',
} as const;
// Frozen v0.1 baselines: v0.1 = the A3 full-cycle L4 baseline (A4.2 adds v0.2 on top of it).
const V01_SHA256 = {
  'keeper.system.v0.1.md': 'baee4191cb312450024637b6a220e68c77e7924da88a600ae237e29cbd5d9cac',
  'judge.system.v0.1.md': '6923b01808a11374326a6cd75f9bbb053684b95d9f8cc74557b98291d33ede02',
} as const;
const sha256 = (name: string): string => createHash('sha256').update(readFileSync(resolve(promptsDir, name))).digest('hex');

type Edit = readonly [old: string, next: string];

function applyEdits(v0: string, edits: readonly Edit[]): string {
  let out = v0;
  for (const [old, next] of edits) {
    expect(v0.split(old).length - 1, old).toBe(1); // occurs EXACTLY once in v0
    out = out.replace(old, () => next);
  }
  return out;
}

const KEEPER_EDITS: readonly Edit[] = [
  ['— v0 (СКЕЛЕТ)', '— v0.1 (СКЕЛЕТ)'],
  [
    '   назначай.\n\nПолный список',
    '   назначай.\n' +
      '5. **Исход не оценивается голосом рассказчика.** Исход и последствия решил движок: ты\n' +
      '   показываешь их в мире, но не выносишь им вердикт — никаких «награды», «повезло»,\n' +
      '   «удалось благодаря…».\n' +
      '\nПолный список',
  ],
  [
    '  два режима (`free_text` и `options`); в MVP — свободный текст. Вопрос задаётся, когда\n' +
      '  выбор игрока определяет следующий ход, а не для украшения.\n',
    '  два режима (`free_text` и `options`); в MVP — свободный текст. Вопрос — только о выборе,\n' +
      '  который **ещё не сделан**. Если в пакете есть исход и последствия (`dice.outcome`, `patch`),\n' +
      '  сцена завершается ими — не спрашивай о том, что уже разыграно; вопрос относится к следующему\n' +
      '  ходу и задаётся, когда выбор игрока его определяет, а не для украшения.\n',
  ],
];

const JUDGE_EDITS: readonly Edit[] = [
  ['— v0 (СКЕЛЕТ)', '— v0.1 (СКЕЛЕТ)'],
  [
    'Ты — строгий судья прозы AI-Хранителя соло-НРИ по «Кольцу Всевластья». Тебе дают\n' +
      '**один фрагмент прозы**. Ты оцениваешь его по 6 осям рубрики и возвращаешь **только JSON**.\n',
    'Ты — строгий судья прозы AI-Хранителя соло-НРИ по «Кольцу Всевластья». Тебе дают\n' +
      '**один фрагмент прозы** и, если есть, входной пакет хода (блок `ВХОДНОЙ ПАКЕТ:`). Ты оцениваешь\n' +
      'прозу по 6 осям рубрики и возвращаешь **только JSON**.\n',
  ],
  [
    '2. **accuracy** — соответствие входному пакету (числа/исходы/оракул не выдуманы; ничего\n' +
      '   из механики вне пакета). Противоречие фактам/числам — низко.\n',
    '2. **accuracy** — соответствие входному пакету. Если пакет дан — сверяй с ним числа, исход,\n' +
      '   оракул и патч: выдуманное или механика вне пакета — низко. Если пакета нет — оценивай\n' +
      '   внутреннюю согласованность.\n',
  ],
];

describe('prompt v0 -> v0.1 diff pin (only approved edits; v0 frozen)', () => {
  it('keeper.system.v0.1.md = v0 + the approved edits, byte-for-byte', () => {
    expect(sha256('keeper.system.v0.md')).toBe(V0_SHA256['keeper.system.v0.md']); // v0 frozen
    expect(applyEdits(read('keeper.system.v0.md'), KEEPER_EDITS)).toBe(read('keeper.system.v0.1.md'));
  });

  it('judge.system.v0.1.md = v0 + the approved edits, byte-for-byte', () => {
    expect(sha256('judge.system.v0.md')).toBe(V0_SHA256['judge.system.v0.md']); // v0 frozen
    expect(applyEdits(read('judge.system.v0.md'), JUDGE_EDITS)).toBe(read('judge.system.v0.1.md'));
  });
});

// v0.1 -> v0.2 (A4.2): the reviewer-approved edits, applied to the frozen v0.1.
const KEEPER_V02_EDITS: readonly Edit[] = [
  ['— v0.1 (СКЕЛЕТ)', '— v0.2 (СКЕЛЕТ)'],
  [
    '   «удалось благодаря…».\n\nПолный список',
    '   «удалось благодаря…».\n' +
      '6. **Имена и предыстория — только из пакета.** Имена мест, NPC, народов и любая предыстория\n' +
      '   (сколько дней в пути, что было вчера) — только из `lore_chunks`, `journal_facts` и строки\n' +
      '   оракула. Если их нет — место безымянно, прошлое не упоминается.\n' +
      '\nПолный список',
  ],
  [
    '- **Проза** сцены (основной выход).\n',
    '- **Проза** сцены (основной выход).\n' +
      '- **Сцена заканчивается открытым положением**, из которого игрок делает следующий ход. Вопрос —\n' +
      '  один из способов, не обязательный; закрытая, самозавершённая сцена — ошибка, как и вопрос\n' +
      '  ради украшения.\n',
  ],
  [
    '  сцена завершается ими — не спрашивай о том, что уже разыграно; вопрос относится к следующему\n' +
      '  ходу и задаётся, когда выбор игрока его определяет, а не для украшения.\n',
    '  они уже разыграны — не спрашивай о них; вопрос относится к следующему ходу.\n',
  ],
  [
    '## 5. Регистр и голос — СЛОТЫ (наполняются из `tone.md`, LT1)\n\n',
    '## 5. Регистр и голос — СЛОТЫ (наполняются из `tone.md`, LT1)\n\n' +
      '- **Лицо и время повествования** — по `tone.md` §1.\n',
  ],
];

const JUDGE_V02_EDITS: readonly Edit[] = [
  ['— v0.1 (СКЕЛЕТ)', '— v0.2 (СКЕЛЕТ)'],
  [
    '2. **accuracy** — соответствие входному пакету. Если пакет дан — сверяй с ним числа, исход,\n' +
      '   оракул и патч: выдуманное или механика вне пакета — низко. Если пакета нет — оценивай\n' +
      '   внутреннюю согласованность.\n',
    '2. **accuracy** — соответствие входному пакету. Если пакет дан — сверяй с ним числа, исход,\n' +
      '   оракул и патч: выдуманное или механика вне пакета — низко; имена мест/NPC и предыстория вне\n' +
      '   `lore_chunks`, `journal_facts` и строки оракула — тоже выдумка, низко. Если пакета нет —\n' +
      '   оценивай внутреннюю согласованность.\n',
  ],
  [
    '3. **playability** — даёт ли сцена игроку, за что зацепиться и что делать дальше; не рельсы,\n' +
      '   не тупик.\n',
    '3. **playability** — даёт ли сцена игроку, за что зацепиться и что делать дальше; не рельсы,\n' +
      '   не тупик. Если пакет дан — сцена должна заканчиваться открытым положением для хода игрока;\n' +
      '   самозавершённая сцена — низко; вопрос не обязателен.\n',
  ],
];

describe('prompt v0.1 -> v0.2 diff pin (only approved edits; v0.1 frozen)', () => {
  it('keeper.system.v0.2.md = v0.1 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('keeper.system.v0.1.md')).toBe(V01_SHA256['keeper.system.v0.1.md']); // v0.1 frozen
    expect(applyEdits(read('keeper.system.v0.1.md'), KEEPER_V02_EDITS)).toBe(read('keeper.system.v0.2.md'));
  });

  it('judge.system.v0.2.md = v0.1 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('judge.system.v0.1.md')).toBe(V01_SHA256['judge.system.v0.1.md']); // v0.1 frozen
    expect(applyEdits(read('judge.system.v0.1.md'), JUDGE_V02_EDITS)).toBe(read('judge.system.v0.2.md'));
  });
});
