# HANDOFF_STAGE3 — самодостаточный вход в Stage 3

Точка входа для пересозданных чатов. Код-HEAD = **`5790ae5`** (трек A: A1 + A2 + A2.1 поверх
опенера Stage 3), сверху — docs-коммит с этим файлом. **Локальный** `main` опережает `origin/main`
(опенер + трек A + docs) до пуша (пуш — только по явной отмашке Ивана). Все факты ниже сверены по
репо, не по памяти.

**Опенер Stage 3 (ВЫПОЛНЕН, см. §4):**
- `a4fb135` feat(stage3): ws-a root npm workspace (topology only, zero behavior change)
- `050fe18` feat(stage3): ws-b real cross-package imports (close R-workspace-2, partial R-workspace-1)

**Трек A — выход Stage 2 / full-cycle (A1–A2.1 ВЫПОЛНЕНЫ, см. §4):**
- `6c4cd2c` feat(stage3): A1 turn-producer (close R-WS1-RESIDUE; channel B step record + extractTurn)
- `61df2ce` feat(stage3): A2 AnthropicKeeper plumbing (LlmClient seam, lossless package render, keeper system assembly, offline mock tests; keeper-smoke keyed-shell entry)
- `5790ae5` fix(stage3): A2.1 render multi-line opaque values as indented block scalars (section-spoof guard)

---

## 1. Архитектура процесса (две роли)

Работа идёт в **двух чатах** с разделением ролей; **Иван — реле** между ними.

- **claude.ai — архитектурный ревьюер.** Держит протоколы и дисциплину, разбирает скелеты и
  результаты, выносит вердикты, даёт «го». Не пишет код в репо.
- **Claude Code Desktop (CCD) — исполнитель в репо.** Рекогносцировка (читает код/состояние) →
  скелет → реализация+тесты. Не принимает архитектурных решений в одиночку.

**Формат обмена — двублочный:** сообщения структурируются как «**Для Ивана**» (пояснение/решение
человеку) и «**Для CCD**» (буквальный промпт исполнителю). Иван переносит блоки между чатами.

**Дисциплина трёх тактов** (нерушимо для каждого крупного деливерабла):
**такт 1 — скелет/план → такт 2 — «го» Ивана через ревьюера → такт 3 — реализация+тесты.**
Этапы не пропускаются. Ревьюер ≠ автор (ADR-001): тот, кто пишет, не верифицирует сам себя.

---

## 2. Где мы (состояние на `ead78d2`)

**Stage 2 закрыт по контент-независимой части.** Нарративный контракт, скелет промпта Хранителя,
anti-slop, eval-харнесс, плумбинг 2.4, LT1-скаффолд+гейт, активация tone.md, тон-судья и его
**успешная калибровка** — сделаны. Что осталось — физически в инфраструктуре Stage 3 (см. §3).

**Цепочка коммитов Stage 2 (`aaac961` → `ead78d2`, 16 шт.):**

- `aaac961` feat(stage2): chat 2.1 narrative contract + keeper prompt skeleton + antislop seed + RV1; add LT1 deferral
- `1632538` docs: correct SD1 mis-classification (scene_details rolled in journey since Stage 1; audit missed listByType); +inspiring_sight; surfacing -> 2.4
- `e8d5e73` feat(stage2): LT1 scaffold + drafts (tone/lore gate, schemas, manifest machinery, pending staging); drafts verified:false
- `040c3b2` docs(stage2): LT1 stoplist severity defaults (phrases=block, ambiguous single words=warn); 2.3 tokenizer-calibration note; roadmap 2.2.b-d scaffold-done
- `c3ce09c` feat(stage2): eval harness scaffold (stub keeper, deterministic judge, 6-axis verdict, plumbing byte-golden); seams for 2.4
- `29702db` feat(stage2): 2.4 plumbing - SD1 Fork A (engine, additive) + structural orchestrator package provider + harness injection; engine/golden byte-identical
- `cd992de` feat(stage2): anti-slop coverage — per-entry severity + purple-phrase block tier + register_parasite bucket; fix VK addendum severity drop (regression-guarded)
- `9daa5b5` fix(stage2): drop high-frequency copula from register_parasite (noisy as warn)
- `8f16dd9` docs(lt1): sign off tone.md + stoplist (verified:true in kv-pending); term10 warn->block
- `f6beb0f` feat(stage2): activate LT1 tone — move tone.md + tone.stoplist.json to live pack (sidecars); evals reads VK addendum from live sidecar
- `76421b8` feat(stage2): tone-judge plumbing — LlmJudge (injected LlmClient, parse+Zod+error-verdict, configurable short-circuit OFF-at-calibration); async-unified Judge; pluggable aggregate
- `013dce0` docs(stage2): few-shot scene drafts v1 (Ivan-accepted by ear) — 6 good incl. elf voice, 4 coarse-bad, 3 subtle-bad
- `469da26` feat(stage2): tone-judge calibration runner (AnthropicLlmClient, cases, env-guarded; offline tests unaffected)
- `84125ac` fix(stage2): tolerant judge JSON extraction + raise judge max_tokens + rawSample on parse-error
- `ead78d2` docs(stage2): tone-judge calibration review-record + roadmap point

(Между `aaac961` и `ead78d2` git показывает 16 коммитов; в списке 15 строк + сам `aaac961` = 16.)

**Тон-судья валиден** (диагностический прогон `claude-opus-4-8`, разбор —
`docs/CALIBRATION_TONE_JUDGE.md`): хорошие **6/6 ≥ 80** (agg 82–85); тонкие **3/3 валятся** при
**чистом детерм. anti_slop** (B5 эпик-инфляция мимо regex поймана судьёй); зазор худший-хороший(82)
/ лучший-плохой(53) **≈ 29**; шкала 0–100 корректна.

**Инварианты (сверены прогоном на `5790ae5`, `test:all` / `typecheck:all` из корня workspace):**
- `engine/` — **394 теста** зелёные; **Cyrillic CLEAN** (perl-скан `src/**/*.ts`); `dependencies: null`.
- `orchestrator/` — **30 тестов** зелёные; `orchestrator/src` — **Cyrillic CLEAN** (тот же perl-скан).
- `evals/` — **50 тестов** зелёные (офлайн, мок-клиент, без ключа/сети).
- Пак `content-packs/kv/` — **`pack_version` 0.1.0**, детерминированная загрузка; 5 golden
  стабильны (Stage 1; byte-identical через опенер; A1 — empty-diff; A2/A2.1 `engine/` не трогали).
- Запуск: `npm run test:all` / `npm run typecheck:all` из корня (порядок engine→orchestrator→evals).

---

## 3. 🔴 Критерий выхода Stage 2 НЕ закрыт

Критерий — **«CLI-сцена с прозой, судья ≥ 80»** — требует **полного цикла**:
**движок → пакет (orchestrator) → Хранитель (AnthropicKeeper) → судья на РЕАЛЬНОМ выходе
Хранителя**, не на few-shot-прозе. Калибровка валидировала судью, но прогон шёл по эталонной
прозе без пакета движка (отсюда `accuracy` 75–85: судья честно пишет «входной пакет не дан»).
Полный цикл физически живёт в **инфраструктуре Stage 3** — поэтому остаток Stage 2 переносится
туда (ожидаемо, см. §4).

---

## 4. Первый шаг Stage 3 = workspace — ✅ ВЫПОЛНЕН (опенер закрыт на `050fe18`)

**Открыватель Stage 3 — root npm workspace** (`@brodyazhnik/engine` / `orchestrator` / `evals`;
`app/` — зарезервированный слот, скаффолдит чат 3.1.a). Сделан в два под-такта:

- **ws-a (`a4fb135`)** — топология, ноль изменения поведения: root `package.json` (workspaces),
  единый root-lock, root `.gitignore` += `/node_modules`, удаление 3 member-lock. Member
  tsconfig/package.json не тронуты. Project references **отвергнуты** (composite ⊥ noEmit);
  кросс-пакет — workspace-symlink + `main:./src/index.ts`; порядок — root-скрипт, не `tsc -b`.
- **ws-b (`050fe18`)** — реальные кросс-пакетные импорты:
  - **`R-workspace-2` ЗАКРЫТ** — evals импортит реальный `buildNarrativePackage`+`NarrativePackage`;
    `ScenarioPackage`-alias удалён; `summary` → `Seed`/`Transcript`. Зеркало RECONCILE 1/4 снято.
  - **`R-workspace-1` ЧАСТИЧНО** — `SceneDetailRow` стал реальным engine-типом (дубль
    `EngineSceneDetail` удалён). **Остаток `R-WS1-RESIDUE` (open)** — dice/patch (camelCase→snake_case)
    + journalFacts + проекция `EngineTurnResult` → full-cycle; см. `docs/DEFERRED.md#R-WS1-RESIDUE` и §5.
  - Гейт B доказан: `@brodyazhnik/*` резолвятся в TS-исходник под tsc И vitest.

**Трек A (критерий выхода Stage 2, full-cycle):**
- ✅ **A1** `6c4cd2c` — turn-producer: `extractTurn` (канал B `StepRecord`); `R-WS1-RESIDUE` закрыт.
- ✅ **A2** `61df2ce` — `AnthropicKeeper` за `Keeper`-швом (инъекция `LlmClient`, как у `LlmJudge`;
  `AnthropicLlmClient` — только в keyed-скриптах); lossless-рендер пакета `renderNarrativePackage`
  (orchestrator; его же переиспользует 3.1.b); `buildKeeperSystem` (промпт + tone.md, байт-симметрично
  сборке судьи); keyed-вход `evals/keeper-smoke.mts`.
- ✅ **A2.1** `5790ae5` — многострочные opaque-значения рендерятся блочным скаляром (`ключ: |` +
  строки с отступом 4 пробела): значение не может подделать структуру пакета.
- ▶ **Следующее — A3:** suite-раннер (5–10 golden, агрегат ≥ 80) + полный цикл: реальный ход
  (`extractTurn` → `buildNarrativePackage`) → `AnthropicKeeper` → судья на живом выводе **с пакетом**
  (см. §5 «Решения ревьюера 27.09») → **критерий выхода Stage 2**; full-cycle floor.
- **lore-активация (LT1, контент Ивана)** — lore-чанки в пак → `pack_version` 0.2.0; RAG-вход +
  тон-сторона полного цикла. Гейтит выход Stage 2.

**НЕ начинать** A3 без явной отмашки Ивана — это его решение об открытии деливерабла.

---

## 5. Запертые развилки (НЕ переоткрывать без явной причины)

- **SD1 Fork A** — деталь сцены экспонируется **аддитивно**; golden `dark-1` **byte-identical**.
  Не перекатывать строку (двойной бросок рассинхронит RNG).
- **Опция 2 (структурный seam) — СНЯТА на workspace (ws-a+ws-b, коммиты ниже).** Root npm
  workspace заведён; кросс-пакет идёт реальными импортами (`@brodyazhnik/engine` /
  `@brodyazhnik/orchestrator` → `main:./src/index.ts`, резолюция в TS-исходник через symlink).
  Статус RECONCILE-инвентаря в `orchestrator/src/provider.ts`:
  - **`R-workspace-1` — ЗАКРЫТ (A1, track A).** `SceneDetailRow` → реальный engine-тип (ws-b);
    producer-residue реализован A1: `extractTurn(prev,next,record)` — реальный продьюсер
    `EngineTurnResult` (`orchestrator/src/provider.ts`); `mapDice` (engine `CheckResult` →
    контрактный `DiceResult`, degree→4-значный исход, анти-хардкод-тест), `diffHeroState`
    (patch диффом prev/next). Канал B: engine `StepRecord` (`stepJourney → [JourneyState, StepRecord]`),
    журнал-лог чист от check-математики, golden empty-diff держится. Сырые грани
    (`feat_die`/`success_dice`) ре-хоумлены в `DEFERRED#DD-DICE-FACES` (UI, DUE 3.2.b);
    `journalFacts:[]` под arch §2.4. **`R-WS1-RESIDUE` → DEFERRED «Закрыто».** Остаётся (отдельно)
    живая прокидка `extractTurn` в цикл хода (track A, A3/L4).
  - **`R-workspace-2` — ЗАКРЫТ (ws-b).** evals импортит реальный `buildNarrativePackage` +
    `NarrativePackage`; `ScenarioPackage`-alias удалён; `fixtureProvider` под `NarrativePackage`;
    `summary` переселён в `Seed`/`Transcript`.
  - **`R-activation(tone.md)` — ОТКРЫТ.** `provisionalLengthFor` остаётся provisional;
    blocked on 2.3.c (перенос длин в tone.md).
  Зеркало — `evals/src/harness/types.ts` RECONCILE: **1 и 4 сняты (ws-b)**; **2/3/5/6/7 на месте**
  (5 — с пометкой A2: класс за швом, живой swap — A3).
- **Per-entry severity** в стоп-листах (block/warn пер-запись; фразы=block, неоднозначные
  одиночные слова=warn) — решено, не пересматривать.
- **`mean(6)` provisional; floor отложен до full-cycle калибровки.** `accuracy` не измерима на
  прозе-only; floor 80 завалил бы 3/6 хороших. `aggregateMean` остаётся как есть до реального
  пакета. Рубрику/`cases.ts`/порог НЕ тюнить (правка под 13 примеров = overfit).
- **Ключ-путь (а)** — `ANTHROPIC_API_KEY` ТОЛЬКО из `process.env` в keyed-вкладке Ивана, **никогда
  не входит в процесс агента**, не пишется/не логируется. `calibrate.mts` и `keeper-smoke.mts`
  гардят наличие ключа до любого вызова API; запускаются из `evals/` (см. §7).

### Решения ревьюера 27.09 (запертые развилки A3 — не переоткрывать)
1. **Судья получает пакет.** `JudgeContext` += опциональный `package?: NarrativePackage | null`;
   `LlmJudge` рендерит его через `renderNarrativePackage` в user-сообщение блоком `ВХОДНОЙ ПАКЕТ:`
   перед `ПРОЗА:`; без пакета поведение байт-идентично текущему (калибровочные кейсы не меняются).
   Рубрику / `cases.ts` / порог НЕ тюнить.
2. **`stop_reason` в `LlmClient` невидим — риск принят** (4096 токенов против целевых ≤ 1500 знаков);
   пересмотр только по факту обрезки в прогоне. Не DEFERRED.
3. **Модель Хранителя:** smoke — на дефолте `claude-opus-4-8`; на L4 — прогон в двух вариантах через
   `KEEPER_MODEL` (Sonnet-класс по arch §8) — это и есть A/B; в запись калибровки внести заметку о
   риске самопредпочтения при совпадении моделей Хранителя и судьи.
4. **Рендер:** многострочные opaque-значения — блочный скаляр `|` + 4 пробела (A2.1); защита от
   подделки структуры — на стороне рендера, а не гейта LT1.

---

## 6. Открытые DEFERRED (эхо из `docs/DEFERRED.md`, DUE ≤ Stage 3)

| Пункт | DUE | Что осталось | Гейт |
|---|---|---|---|
| **LT1** | Этап 2 | lore-остаток → `pack_version` 0.2.0 (tone.md уже активирован) | 🔴 **гейтит выход Stage 2** (судья ≥80 опирается на tone+lore); вход полного цикла |
| **SD1** | Этап 2 → 2.4 | live-сюрфейсинг **opaque-row** целиком в `oracle.detail` пакета (механика и плумбинг сделаны) | гейтит полный путь `oracle.detail`; закрывается на workspace/full-cycle |
| **RV1** | content-gate (не roadmap-этап) | image-сверка `source_text` 4 карт (структурный проход — все PASS; нужны сканы у владельца) | не блокирует движок; блокирует доверие к `verified:true` этих карт |
| **MX1** | Этап 2 или 4 (низкий) | Advance-бонус на core-дальнем выходе из боя | не гейтит; косметика §3.7 |
| **DD-DICE-FACES** | Stage 3.2.b | сырые грани (`feat_die`/`success_dice`) для UI-панели костей; `extractTurn` их намеренно не заполняет | не гейтит Хранителя и выход Stage 2; только UI |

**Watch (не в списке DUE≤3, но рядом):** **HC1** (создание героя) — DUE Этап 4, но `DEFERRED.md`
помечает «вероятно нужно в Этапе 3 (лист героя)»; в роадмапе — развилка 3.3 (по умолчанию держать
готового/импортного героя, HC1 не тянуть в Stage 3).

---

## 7. Дисциплина (нерушимо)

- **verify-before-fix** — состояние проверяется **кодом** (тесты/grep/чтение файла) до правки, не
  по памяти. Числа из артефактов (напр. калибровка) берутся из реального файла, не из диалога.
- **Ключ только `env`**, артефакты с ключом/сырьём — **gitignored** (`calibration-report.json`,
  `.env`); подтверждать `git check-ignore` перед коммитом.
- **Реестр в репо > память.** Источники правды: `brodyazhnik-architecture-v1.md` →
  верифицированный пак → `docs/DEFERRED.md` / `docs/ROADMAP_SESSIONS.md`. Память дрейфует, репо нет.
- **Коммиты — ASCII**; `git add` новых файлов **явно**; команды из **корня** репо. Многострочные
  сообщения с бэктиками/кавычками — через `git commit -F <file>`, не `-m` (zsh ломается).
- **Код — ASCII** (`engine/src/**/*.ts` без кириллицы; `name_ru` и пр. в JSON-паке — можно).
  Скан: `find src -name '*.ts' | xargs perl -CSD -ne 'exit 1 if /\p{Cyrillic}/'`.
- **pristine-extract** для changeset/контент-хэшей — хэши пака/чейнджсета считаются с чистого
  извлечения, не с грязного дерева (воспроизводимость).
- **ADR-001** — ревьюер ≠ автор: верифицирующий проход независим от пишущего (касается и
  контент-гейтов, и кода).
- **Keyed-скрипты — из `evals/`**: `cd evals && npx tsx <script>.mts` (`calibrate.mts`,
  `keeper-smoke.mts`). В корне workspace нет `tsx` (корневой `node_modules` — только
  `@brodyazhnik`); `npx tsx` из корня не найдёт локальный и предложит скачать из registry.

---

## Первое сообщение нового чата CCD (рекомендация)

Сначала **ориентировка**: прочитать `CLAUDE.md` → `brodyazhnik-architecture-v1.md` →
`docs/ROADMAP_SESSIONS.md` → `docs/DEFERRED.md` → **этот файл** → последний коммит; подтвердить
порядок чтения, состояние (код-HEAD `5790ae5` + docs-коммит, инварианты 394/30/50, pack 0.1.0)
и эхо-вывести DEFERRED с DUE ≤ Stage 3. Задачу (A3) давать **после** подтверждения ориентировки,
тактом 1 (скелет), через ревьюера.
