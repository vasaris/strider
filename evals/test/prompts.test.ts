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
// Frozen v0.2 judge: v0.2 = the judge of the A4 calibration run (A4.3 adds v0.3 on top of it).
const JUDGE_V02_SHA256 = 'd529b0a01bc569161179fe1b919ca983a38557232e20c5c8a3056e7f6f94ac5f';
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

// v0.2 -> v0.3 judge (A4.3): the playability item returns to v0.1 byte-for-byte (the v0.2
// open-position addition leaked into package-less grading); the accuracy addition stays.
const JUDGE_V03_EDITS: readonly Edit[] = [
  ['— v0.2 (СКЕЛЕТ)', '— v0.3 (СКЕЛЕТ)'],
  [
    '   не тупик. Если пакет дан — сцена должна заканчиваться открытым положением для хода игрока;\n' +
      '   самозавершённая сцена — низко; вопрос не обязателен.\n',
    '   не тупик.\n',
  ],
];

/** The playability rubric item: from '3. **playability**' up to the start of '4. **agency**'. */
function playabilityItem(text: string): string {
  const start = text.indexOf('3. **playability**');
  const end = text.indexOf('4. **agency**');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe('judge prompt v0.2 -> v0.3 diff pin (A4.3; v0.2 frozen)', () => {
  it('judge.system.v0.3.md = v0.2 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('judge.system.v0.2.md')).toBe(JUDGE_V02_SHA256); // v0.2 frozen
    expect(applyEdits(read('judge.system.v0.2.md'), JUDGE_V03_EDITS)).toBe(read('judge.system.v0.3.md'));
  });

  it('the playability item in v0.3 is byte-identical to v0.1', () => {
    expect(playabilityItem(read('judge.system.v0.3.md'))).toBe(playabilityItem(read('judge.system.v0.1.md')));
  });
});

// v0.2 -> v0.3 keeper, v0.3 -> v0.4 judge (3.1-C3): TP1 (days, arrival, travel roll and detection)
// now reaches the Keeper package as `## detection` and `## journey`. Keeper §2 p.6 and §3 add
// those sections as legitimate name/backstory sources; keeper §3 carries the reviewer's D1 clause
// (a hidden detection shows only what the hero perceives, rule 3) and the P2 wording ("бросок
// Путешествия этого перехода"). The judge accuracy item gets the matching source addition; no new
// penalty axis.
const KEEPER_V02_SHA256 = '9fe6101b4b645408a3e38f675afddd2f82102fef965b3f3ea0d9389002319cb3';
const JUDGE_V03_SHA256 = '68afa316ba81ec20484ea4b3f9ea921937d678754cb55ae715c90e545b42cf0e';

const KEEPER_V03_EDITS: readonly Edit[] = [
  ['— v0.2 (СКЕЛЕТ)', '— v0.3 (СКЕЛЕТ)'],
  [
    '   (сколько дней в пути, что было вчера) — только из `lore_chunks`, `journal_facts` и строки\n' +
      '   оракула. Если их нет — место безымянно, прошлое не упоминается.\n',
    '   (сколько дней в пути, что было вчера) — только из `lore_chunks`, `journal_facts`, строки\n' +
      '   оракула, сцены обнаружения (`detection`) и раздела пути (`journey`). Если их нет — место\n' +
      '   безымянно, прошлое не упоминается.\n',
  ],
  [
    '- `oracle` — результат оракула (+ `detail` второго уровня, если есть). См. правило 2.\n',
    '- `oracle` — результат оракула (+ `detail` второго уровня, если есть). См. правило 2.\n' +
      '- `detection` — сцена обнаружения (строка пака). Если герой сталкивается с ней сам — вплетается\n' +
      '  как оракул (правило 2). Если по смыслу строки событие происходит без его ведома (кто-то\n' +
      '  узнаёт, что-то захвачено вдали) — само событие в прозе не раскрывается: только то, что герой\n' +
      '  воспринимает здесь (правило 3).\n',
  ],
  [
    '- `patch` — что изменилось в состоянии (Изнурение/Надежда/Тень/Око/состояния). Вплетай\n' +
      '  последствие как ощутимое в мире, не как строку трекера.\n',
    '- `patch` — что изменилось в состоянии (Изнурение/Надежда/Тень/Око/состояния). Вплетай\n' +
      '  последствие как ощутимое в мире, не как строку трекера.\n' +
      '- `journey` — путь этого шага: `days_delta` — на сколько дней шаг сдвинул путь (0 — не сдвинул);\n' +
      '  на прибытии — `arrived` и `days_total` (итог дней пути); `travel_check` — бросок Путешествия\n' +
      '  этого перехода. Это не исход сцены: исход сцены — только `dice`.\n',
  ],
];

const JUDGE_V04_EDITS: readonly Edit[] = [
  ['— v0.3 (СКЕЛЕТ)', '— v0.4 (СКЕЛЕТ)'],
  [
    '   `lore_chunks`, `journal_facts` и строки оракула — тоже выдумка, низко. Если пакета нет —\n' +
      '   оценивай внутреннюю согласованность.\n',
    '   `lore_chunks`, `journal_facts`, строки оракула, сцены обнаружения (`detection`) и раздела\n' +
      '   пути (`journey`) — тоже выдумка, низко. Если пакета нет — оценивай внутреннюю согласованность.\n',
  ],
];

describe('prompt diff pin 3.1-C3 (keeper v0.2 -> v0.3, judge v0.3 -> v0.4; bases frozen)', () => {
  it('keeper.system.v0.3.md = v0.2 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('keeper.system.v0.2.md')).toBe(KEEPER_V02_SHA256); // v0.2 frozen
    expect(applyEdits(read('keeper.system.v0.2.md'), KEEPER_V03_EDITS)).toBe(read('keeper.system.v0.3.md'));
  });

  it('judge.system.v0.4.md = v0.3 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('judge.system.v0.3.md')).toBe(JUDGE_V03_SHA256); // v0.3 frozen
    expect(applyEdits(read('judge.system.v0.3.md'), JUDGE_V04_EDITS)).toBe(read('judge.system.v0.4.md'));
  });
});

// v0.3 -> v0.4 keeper (3.3a-K4): beats. Keeper §2 p.6 adds the player's words (`player.approach`,
// `questions`) and the previous beat's prose (`previous`) as legitimate name sources in beats, and a
// new §8 "Такты" describes the beat kinds (setup / resolution / arrival / encounter) and the
// `## player`, `## questions`, `## previous` sections. Judge unchanged.
const KEEPER_V03_SHA256 = '8f9ebc023597e244a484660f35de8286f449e875eed705b18d4b2efb1e03d7a8';

const KEEPER_V04_EDITS: readonly Edit[] = [
  ['— v0.3 (СКЕЛЕТ)', '— v0.4 (СКЕЛЕТ)'],
  [
    '   оракула, сцены обнаружения (`detection`) и раздела пути (`journey`). Если их нет — место\n' +
      '   безымянно, прошлое не упоминается.\n',
    '   оракула, сцены обнаружения (`detection`) и раздела пути (`journey`); в тактах — ещё из слов\n' +
      '   игрока (`player.approach`, `questions`) и прозы прошлого такта (`previous`), см. §8. Если их\n' +
      '   нет — место безымянно, прошлое не упоминается.\n',
  ],
  [
    'он **становится** конкретным событием здешней сцены. Не сглаживай его в общие слова.\n',
    'он **становится** конкретным событием здешней сцены. Не сглаживай его в общие слова.\n' +
      '\n' +
      '## 8. Такты\n' +
      '\n' +
      'Шаг пути разложен на такты. Вид такта — `beat` в разделе `## turn`; пакет без `beat` — целый шаг,\n' +
      'как раньше.\n' +
      '\n' +
      '- **`setup` — завязка.** Путь за этот переход и сцена до момента проверки: где герой, что встало\n' +
      '  на пути, как это звучит, пахнет, ложится под руку. Исхода сцены ещё нет — в пакете нет `dice`, не\n' +
      '  описывай его. Что герой сделает в самой сцене, решает игрок: этого действия не пиши. Сцена\n' +
      '  кончается тем, что герой стоит перед испытанием; вариантов на выбор не перечисляй.\n' +
      '- **`resolution` — развязка.** Продолжает `## previous` — завязку этой же сцены. Сцена уже введена:\n' +
      '  оракул остаётся её предметом, заново его не представляй; не повторяй образы и обороты завязки,\n' +
      '  держи то же время суток и место. Исход — только из `dice`, последствия — только из `patch` и\n' +
      '  `journey`. `player.approach` — как герой пытается действовать, а не что у него вышло: удалось ли —\n' +
      '  решают кости. Исход, которого кости не дали, не дари. Конец — открытое положение, без вариантов,\n' +
      '  на которые игроку пока нечем ответить.\n' +
      '- **`arrival` — прибытие, `encounter` — значимая встреча.** Целый шаг, как в §3 и §4.\n' +
      '- **`## player`** — ход игрока к броску этого такта: в развязке это проверка сцены (`dice`), в\n' +
      '  остальных тактах — бросок пути (`journey.travel_check`). `hope_spent: 1` — герой собрал силы перед\n' +
      '  броском: это усилие, а не последствие, и без чисел; отрицательная `hope_delta` в `patch` этого\n' +
      '  такта — та же трата, а не потеря. `approach` — слова игрока о том, как действует герой: намерение,\n' +
      '  а не факт.\n' +
      '- **`## questions`** — вопросы игрока оракулу и ответы движка. Ответ — факт мира: вплети его в\n' +
      '  сцену, не пересказывая вопрос. Ответ с `extreme: true` (пояснение — `note`) — поворот, а не просто\n' +
      '  «да» или «нет». Текст вопроса — слова игрока, сам по себе он ничего не утверждает.\n' +
      '- **`## previous`** — принятая проза прошлого такта. Время, место, погода и состояние героя те же,\n' +
      '  пока пакет не говорит иного. Не пересказывай её.\n' +
      '- **Имена.** Имена из `player.approach`, `questions` и `## previous` можно брать; новых поверх них\n' +
      '  не выдумывай (правило 6).\n',
  ],
];

describe('prompt diff pin 3.3a-K4 (keeper v0.3 -> v0.4; v0.3 frozen)', () => {
  it('keeper.system.v0.4.md = v0.3 + exactly the approved edits, byte-for-byte', () => {
    expect(sha256('keeper.system.v0.3.md')).toBe(KEEPER_V03_SHA256); // v0.3 frozen
    expect(applyEdits(read('keeper.system.v0.3.md'), KEEPER_V04_EDITS)).toBe(read('keeper.system.v0.4.md'));
  });
});

// prompts/assembly.v1.json (3.1-C4): the Keeper/judge request framing moved out of evals source
// into this file. Frozen from now on (sha256), and its two values are the pre-C4 evals literals
// byte-for-byte (keeperSystem.ts TONE_SIDECAR_SEPARATOR; anthropicKeeper.ts buildKeeperUser preamble).
const ASSEMBLY_V1_SHA256 = '6328dc596882834fe41bcd9a4602be50e15e330af57c0242a76bb472e22d0503';

describe('prompts/assembly.v1.json (3.1-C4; frozen)', () => {
  it('is pinned by sha256 and carries the pre-C4 literals byte-for-byte', () => {
    expect(sha256('assembly.v1.json')).toBe(ASSEMBLY_V1_SHA256);
    const doc = JSON.parse(read('assembly.v1.json')) as Record<string, unknown>;
    expect(Object.keys(doc)).toEqual(['schema', 'tone_sidecar_separator', 'keeper_user_preamble']);
    expect(doc['schema']).toBe('brodyazhnik.prompt-assembly/1');
    expect(doc['tone_sidecar_separator']).toBe('\n\n---\n\n# Активированный tone.md (живой сайдкар)\n\n');
    expect(doc['keeper_user_preamble']).toBe('Входной пакет хода — единственный источник фактов. Напиши прозу сцены.\n\n');
  });
});
