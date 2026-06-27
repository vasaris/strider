# HANDOFF_STAGE3 — самодостаточный вход в Stage 3

Точка входа для пересозданных чатов. HEAD = **`ead78d2`** (== `origin/main`, запушено).
Все факты ниже сверены по репо на этом коммите, не по памяти.

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

**Инварианты (сверены прогоном на `ead78d2`):**
- `engine/` — **389 тестов** зелёные; **Cyrillic CLEAN** (perl-скан `src/**/*.ts`).
- `evals/` — **44 теста** зелёные (офлайн, мок-клиент, без ключа/сети).
- `orchestrator/` — **9 тестов** зелёные.
- Пак `content-packs/kv/` — **`pack_version` 0.1.0**, детерминированная загрузка; 5 golden
  стабильны (Stage 1).

---

## 3. 🔴 Критерий выхода Stage 2 НЕ закрыт

Критерий — **«CLI-сцена с прозой, судья ≥ 80»** — требует **полного цикла**:
**движок → пакет (orchestrator) → Хранитель (AnthropicKeeper) → судья на РЕАЛЬНОМ выходе
Хранителя**, не на few-shot-прозе. Калибровка валидировала судью, но прогон шёл по эталонной
прозе без пакета движка (отсюда `accuracy` 75–85: судья честно пишет «входной пакет не дан»).
Полный цикл физически живёт в **инфраструктуре Stage 3** — поэтому остаток Stage 2 переносится
туда (ожидаемо, см. §4).

---

## 4. Первый шаг Stage 3 = workspace (решение Ивана)

**Открыватель Stage 3 — root workspace** (`@brodyazhnik/engine` / `orchestrator` / `evals` + `app/`).

- **Зачем именно сейчас (конкретный driver, не гипотеза):** первая реальная кросс-пакетная
  зависимость уже пришла в 2.4-plumbing — `orchestrator/provider.ts` маппит вывод движка, а
  eval-харнесс зовёт orchestrator. Сейчас они связаны **структурными seam'ами** (Option 2:
  структурный `EngineTurnResult`, harness-alias) — без относительных импортов. Workspace
  разблокирует кросс-пакетные импорты (`@brodyazhnik/engine`) и снимает эти seam'ы реальными
  типами (закрывает `R-workspace-1/2`).
- **За workspace (параллельно/после):**
  - **lore-активация (LT1)** — контент Ивана, фоновый трек: lore-чанки в пак → `pack_version`
    0.2.0; разблокирует RAG-вход и закрывает тон-сторону полного цикла.
  - **полный цикл** — `AnthropicKeeper` (реальный Хранитель за тем же `Keeper`-швом, что StubKeeper)
    + реальный orchestrator-пакет (`buildNarrativePackage`) → судья на живом выводе → **критерий
    выхода Stage 2**. Сюда же suite-раннер (5–10 golden, агрегат ≥ 80) и full-cycle floor.

**НЕ начинать** workspace / Keeper / Stage 3 без явной отмашки Ивана — это его решение об
открытии этапа.

---

## 5. Запертые развилки (НЕ переоткрывать без явной причины)

- **SD1 Fork A** — деталь сцены экспонируется **аддитивно**; golden `dark-1` **byte-identical**.
  Не перекатывать строку (двойной бросок рассинхронит RNG).
- **Опция 2 (структурный seam)** — кросс-пакет через структурные типы сейчас; **реальные типы —
  на workspace**. Долг явно зафиксирован, чтобы не растворялся: **RECONCILE-инвентарь в
  `orchestrator/src/provider.ts`** — `R-workspace-1` (структурный `EngineTurnResult` → реальные
  engine-типы, camelCase→snake_case), `R-workspace-2` (3-полевой harness-адаптер → реальный
  `buildNarrativePackage`), `R-activation(tone.md)` (`provisionalLengthFor` → длины из tone.md).
  Зеркало — `evals/src/harness/types.ts` RECONCILE 1–7.
- **Per-entry severity** в стоп-листах (block/warn пер-запись; фразы=block, неоднозначные
  одиночные слова=warn) — решено, не пересматривать.
- **`mean(6)` provisional; floor отложен до full-cycle калибровки.** `accuracy` не измерима на
  прозе-only; floor 80 завалил бы 3/6 хороших. `aggregateMean` остаётся как есть до реального
  пакета. Рубрику/`cases.ts`/порог НЕ тюнить (правка под 13 примеров = overfit).
- **Ключ-путь (а)** — `ANTHROPIC_API_KEY` ТОЛЬКО из `process.env` в keyed-вкладке Ивана, **никогда
  не входит в процесс агента**, не пишется/не логируется. `calibrate.mts` гардит наличие ключа
  до любого вызова API.

---

## 6. Открытые DEFERRED (эхо из `docs/DEFERRED.md`, DUE ≤ Stage 3)

| Пункт | DUE | Что осталось | Гейт |
|---|---|---|---|
| **LT1** | Этап 2 | lore-остаток → `pack_version` 0.2.0 (tone.md уже активирован) | 🔴 **гейтит выход Stage 2** (судья ≥80 опирается на tone+lore); вход полного цикла |
| **SD1** | Этап 2 → 2.4 | live-сюрфейсинг **opaque-row** целиком в `oracle.detail` пакета (механика и плумбинг сделаны) | гейтит полный путь `oracle.detail`; закрывается на workspace/full-cycle |
| **RV1** | content-gate (не roadmap-этап) | image-сверка `source_text` 4 карт (структурный проход — все PASS; нужны сканы у владельца) | не блокирует движок; блокирует доверие к `verified:true` этих карт |
| **MX1** | Этап 2 или 4 (низкий) | Advance-бонус на core-дальнем выходе из боя | не гейтит; косметика §3.7 |

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

---

## Первое сообщение нового чата CCD (рекомендация)

Сначала **ориентировка**: прочитать `CLAUDE.md` → `brodyazhnik-architecture-v1.md` →
`docs/ROADMAP_SESSIONS.md` → `docs/DEFERRED.md` → **этот файл** → последний коммит; подтвердить
порядок чтения, состояние (HEAD `ead78d2`, инварианты 389/44/9, pack 0.1.0) и эхо-вывести
DEFERRED с DUE ≤ Stage 3. Задачу (workspace) давать **после** подтверждения ориентировки, тактом 1
(скелет), через ревьюера.
