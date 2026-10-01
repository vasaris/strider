# HANDOFF_STAGE3 — самодостаточный вход в Stage 3 (после закрытия Stage 2)

> **Исторический документ** (вход в Stage 3, 27.09; код-HEAD `7d67954`). Текущая точка входа —
> **`docs/HANDOFF_STAGE3_1_PART2.md`** (после блока I чата 3.1). Имена ниже — на момент записи:
> `extractTurn` с 3.1-C2 (`6959977`) — внутренний `projectStep`, публичный производитель —
> `extractJourneyTurn`; фикстура `evalHero` с 3.1-C4 (`5937e3a`) — orchestrator `pregenWanderer` /
> `startJourney` (drift-пин против `engine/src/cli/scenario.ts` остался test-only в evals).
> Пометки «требует подтверждения ревьюера» ниже (SD1, MX1) — исторические: подтверждено в вердикте
> скелета чата 3.1.

Точка входа для пересозданных чатов. Код-HEAD = **`7d67954`** (опенер Stage 3 + трек A
закрыли Stage 2), сверху — docs-коммит с этим файлом. **Локальный** `main` опережает
`origin/main` (13 код/docs-коммитов до этого docs-коммита: опенер `a4fb135`, `050fe18`, docs
`7e050ed`, трек A `6c4cd2c`..`7d67954`) до пуша. **Пуш — только после сверки ревьюера**
(решение Ивана 27.09). Все факты ниже сверены по репо (git log, `test:all`, `typecheck:all`,
perl-скан, файлы отчётов), не по памяти.

**Опенер Stage 3 (ВЫПОЛНЕН, см. §4):**
- `a4fb135` feat(stage3): ws-a root npm workspace (topology only, zero behavior change)
- `050fe18` feat(stage3): ws-b real cross-package imports (close R-workspace-2, partial R-workspace-1)
- `7e050ed` docs(stage3): handoff post-opener state (HEAD 050fe18; workspace DONE; R-WS1-RESIDUE open)

**Трек A — выход Stage 2 / полный цикл (ВЫПОЛНЕН, см. §4):** 10 коммитов `6c4cd2c`..`7d67954`
(список — §2).

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

## 2. Где мы (состояние на `7d67954`)

**✅ Stage 2 ЗАКРЫТ** — критерий «CLI-сцена с прозой, судья ≥ 80» выполнен (вердикт ревьюера
27.09). Полный цикл L4: **движок → пакет (`journeyTurn`) → `AnthropicKeeper` → LLM-судья с
тем же пакетом**, keeper **v0.2** + judge **v0.3**, судья `claude-opus-4-8` во всех прогонах:

| Хранитель | прошло | mean | min | hard-gate fails |
|-----------|:---:|----:|----:|:---:|
| `claude-opus-4-8` | **9/9** | **88.4** | 87 | 0 |
| `claude-sonnet-5` | **8/9** | **84.4** | 78 | 0 |

Разбор, поштучные таблицы и калибровка судьи v0 → v0.3 — `docs/CALIBRATION_TONE_JUDGE.md`,
§«L4, 27.09 — закрытие Stage 2». **Аудит-след L4 закоммичен** в `evals/l4-records/`
(провенанс — его `README.md`): stdout калибровок v0.1–v0.3 и сырые отчёты полного цикла
v0.1 / v0.3 (с sha256 промптов). Рабочие отчёты `evals/*-report*.json` — gitignored.

**Инварианты (сверены прогоном на `7d67954`, `test:all` / `typecheck:all` из корня):**
- `engine/` — **394 теста** зелёные (47 файлов, вкл. 5 golden-тестов: combat / journey /
  council / progression / fellowship; их эталоны не менялись за трек A — `git diff 6c4cd2c^..HEAD
  -- engine/` трогает только journey-исходники и `stepRecord.test.ts`); **Cyrillic CLEAN**.
- `orchestrator/` — **36 тестов** зелёные; `orchestrator/src` — **Cyrillic CLEAN**.
- `evals/` — **89 тестов** зелёные (офлайн, мок-клиент, без ключа/сети).
- `typecheck:all` — чисто. Пак `content-packs/kv/` — **`pack_version` 0.1.0** (tone.md —
  сайдкар вне манифеста; §1-поправка `f58e3fe` версию не бампала).
- Запуск: `npm run test:all` / `npm run typecheck:all` из корня (порядок engine→orchestrator→evals).

**Коммиты с `6c4cd2c` (трек A, 10 шт., `git log --oneline 6c4cd2c^..HEAD`):**
- `6c4cd2c` feat(stage3): A1 turn-producer (close R-WS1-RESIDUE; channel B step record + extractTurn)
- `61df2ce` feat(stage3): A2 AnthropicKeeper plumbing (LlmClient seam, lossless package render, keeper system assembly, offline mock tests; keeper-smoke keyed-shell entry)
- `5790ae5` fix(stage3): A2.1 render multi-line opaque values as indented block scalars (section-spoof guard)
- `e75b228` docs(stage3): A2+A2.1 landed; reviewer decisions 27.09 (A3 judge sees package; stop_reason watch; L4 model A/B)
- `b280d81` fix(stage3): A3.1 render: any Unicode line terminator triggers the block scalar
- `d330bf1` feat(stage3): A3.2 judge sees the package; keeper and judge prompts v0.1
- `19a5c66` feat(stage3): A3.3 engine provider + suite runner + full-cycle keyed entry
- `2527f0c` feat(stage3): A4.1 mixed-script gate; package-sourced length bounds (close RECONCILE 3); scene-check-only dice
- `f58e3fe` feat(stage3): A4.2 keeper and judge prompts v0.2; tone.md sec 1 person and tense
- `7d67954` fix(stage3): A4.3 judge prompt v0.3 -- drop playability addition (leaks into package-less grading; v0.1 already scored closed scenes low)

Плюс до них — опенер `a4fb135`, `050fe18` и docs `7e050ed` (итого **13 впереди `origin/main`**
до этого docs-коммита). Цепочка Stage 2 (`aaac961` → `ead78d2`, 16 шт.) — в git log и
`docs/ROADMAP_SESSIONS.md`.

---

## 3. Реестр RECONCILE (зеркало кода)

**`evals/src/harness/types.ts` — RECONCILE (фактические статусы в комментарии-шапке):**

| # | Что | Статус |
|---|-----|--------|
| 1 | `ScenarioPackage`-alias → orchestrator `NarrativePackage` | **CLOSED** (ws-b) |
| 2 | `KeeperOutput.questions: string[]` → `ClarifyingQuestion[]` | OPEN — рядом с реальным `KeeperOutput` |
| 3 | `lengthTarget` из пакета (`runScenario` берёт `pkg.length_target`, пакет главнее вызывающего) | **CLOSED** (A4.1 `2527f0c`); числа — provisional до `R-activation(tone.md)` |
| 4 | `packageProvider`-фикстура → реальный `buildNarrativePackage` | **CLOSED** (ws-b) |
| 5 | Keeper: `StubKeeper` → `AnthropicKeeper` | OPEN (формулировка в коде: «full-cycle»; A2 поставил класс за швом, живой swap прогнан L4 через keyed-вход `full-cycle.mts`) |
| 6 | LLM-судья ЗАМЕНЯЕТ детерм. ось `anti_slop` (не суммировать) | OPEN — judge |
| 7 | Aggregation guard: вердикт ≥ 80 только при всех 6 осях `scored` | OPEN — до full-cycle floor |

**`orchestrator/src/provider.ts` — RECONCILE:**
- **`R-workspace-1` — ЗАКРЫТ** (ws-b + A1: `extractTurn`, `mapDice`, `diffHeroState`).
- **`R-workspace-2` — ЗАКРЫТ** (ws-b; зеркало RECONCILE 1/4).
- **`R-activation(tone.md)` — ОТКРЫТ.** Длины (`PROVISIONAL_LENGTH` / `provisionalLengthFor`,
  arch §2.3.4) — provisional в коде, пока `tone.md` ими не владеет; вход — `DEFERRED#C2`
  (калибровка длин, контент Ивана).

---

## 4. Трек A — ✅ ЗАКРЫТ (Stage 2 exit)

**Опенер (workspace):** ws-a `a4fb135` (root npm workspace, топология) · ws-b `050fe18`
(реальные кросс-пакетные импорты; R-workspace-2 закрыт, R-workspace-1 частично).

- **A1** `6c4cd2c` — turn-producer: `extractTurn` по каналу B (`StepRecord`); R-WS1-RESIDUE закрыт.
- **A2** `61df2ce` — `AnthropicKeeper` за `Keeper`-швом (инъекция `LlmClient`); lossless-рендер
  пакета `renderNarrativePackage`; `buildKeeperSystem`; keyed-вход `keeper-smoke.mts`.
- **A2.1** `5790ae5` — многострочные opaque-значения → блочный скаляр (защита от подделки секций).
- **A3.1** `b280d81` — все 8 Unicode-терминаторов строки включают блочный скаляр.
- **A3.2** `d330bf1` — судья видит пакет (`JudgeContext.package`); промпты keeper/judge v0.1.
- **A3.3** `19a5c66` — `journeyTurn` (orchestrator) + engine provider + suite-раннер (9 сидов)
  + keyed-вход полного цикла `full-cycle.mts`.
- **A4.1** `2527f0c` — гейт `mixed_script`; длины из пакета (RECONCILE 3); кости только сцены.
- **A4.2** `f58e3fe` — промпты keeper/judge v0.2; tone.md §1 лицо и время.
- **A4.3** `7d67954` — judge v0.3: убрана playability-добавка v0.2.

---

## 5. Запертые развилки / решения 27.09 (НЕ переоткрывать)

**Ранее запертые (Stage 2 / опенер):**
- **SD1 Fork A** — деталь сцены экспонируется **аддитивно**; golden `dark-1` **byte-identical**.
  Не перекатывать строку (двойной бросок рассинхронит RNG). SD1 закрыт (`DEFERRED` «Закрыто»).
- **Опция 2 (структурный seam) — СНЯТА workspace'ом** (ws-a + ws-b); кросс-пакет — реальные
  импорты `@brodyazhnik/*` → `main:./src/index.ts`.
- **Per-entry severity** в стоп-листах (фразы=block, неоднозначные одиночные слова=warn).
- **`mean(6)` provisional; floor не введён.** `aggregateMean` как есть; рубрику / `cases.ts` /
  порог НЕ тюнить под 13 примеров (overfit). Правка `cases.ts` — только контент-решением
  Ивана (`DEFERRED#C4`).
- **Ключ-путь (а)** — `ANTHROPIC_API_KEY` ТОЛЬКО из `process.env` в keyed-вкладке Ивана,
  **никогда не входит в процесс агента**, не пишется/не логируется; keyed-скрипты гардят ключ
  до любого вызова API.

**Вердикт A2 (решения ревьюера 27.09):**
1. **Судья получает пакет** (`JudgeContext.package`, блок `ВХОДНОЙ ПАКЕТ:` перед `ПРОЗА:`);
   без пакета — байт-идентично прежнему.
2. **`stop_reason` в `LlmClient` невидим — риск принят** (4096 токенов против целевых
   ≤ 1500 знаков); пересмотр только по факту обрезки. Не DEFERRED.
3. **Модель Хранителя:** на L4 — два варианта через `KEEPER_MODEL` (A/B); риск
   самопредпочтения при совпадении моделей Хранителя и судьи — в записи калибровки.
4. **Рендер:** многострочные opaque-значения — блочный скаляр `|` + 4 пробела; защита от
   подделки структуры — на стороне рендера, не гейта LT1.

**Вердикт A3:**
- Правки промпта судьи (и Хранителя) = **новые версионные файлы**; ранние версии заморожены
  **sha256-пинами** (`prompts.test.ts`).
- Пакет прогона инжектится в ctx судьи в `runScenario` и **главнее** пакета вызывающего.
- **Проход сценария** = `aggregate.pass` **И** детерм. hard gate **И** нет eval-ошибки;
  eval-ошибки **исключены** из pass-rate и помечаются на перепрогон; **suite pass-rate ≥ 0.8 —
  PROVISIONAL**.
- `journeyTurn` живёт в **orchestrator** (его переиспользует роут 3.1.b).
- `evals` объявляет зависимость `@brodyazhnik/engine`; фикстура `evalHero` + drift-пин через
  **test-only** deep import.
- **Все 8** Unicode-терминаторов строки включают блочный скаляр.
- Отчёт полного цикла — **на модель Хранителя** (`full-cycle-report.<keeper-model>.json`).
- Процесс: каждый код-коммит зелёный; **независимый верификатор перед каждым коммитом**; docs —
  после вердикта.

**Вердикт A4:**
- **`mixed_script`**: токен = буквы/метки/цифры; к письменности считаются **только БУКВЫ**;
  только латиница + кириллица; **block**; в каждом потребителе `scanProse` (оба судьи + гейты LT1).
- **Длины из пакета главнее `ctx.lengthTarget`** — RECONCILE 3 закрыт.
- **Кости — только из проверки сцены**: значимая встреча и шаг прибытия костей не несут;
  travel-проверка возвращается в пакет **только вместе с днями** (`DEFERRED#TP1`).
- **Строка оракула — третий источник имён** для Хранителя и судьи (рядом с `lore_chunks`,
  `journal_facts`).
- Keeper §4: **сцена заканчивается открытой позицией** для хода игрока (вопрос — один из
  способов, не обязателен).
- Добавки судье — **только при наличии пакета**.
- **tone.md §1 лицо и время** (второе лицо, прошедшее время повествования) — с sign-off LT1
  (`docs/LT1_TONE_REVIEW.md`), **без бампа `pack_version`**.

**A4.3:** judge v0.3 **убирает playability-добавку v0.2** — она протекала в оценку без пакета, а
v0.1 уже низко оценивал закрытые сцены. Принцип: **не добавлять судье правил под дефекты,
которые он уже видит.**

**Решения Ивана 27.09:**
- **LT1 → качество Stage 3**, не гейт выхода Stage 2.
- **Пуш — после сверки ревьюера.**
- **Лицо/время — в tone.md §1.**

---

## 6. Открытые DEFERRED (эхо из `docs/DEFERRED.md`, DUE ≤ Stage 3)

| Пункт | DUE | Что осталось | Гейт |
|---|---|---|---|
| **TP1** | Stage 3.1.b | дни пути + обнаружение/прибытие в пакет; travel-проверка — только вместе с днями | до живой многошаговой игры |
| **NF1** | первый eval-коммит Stage 3 | детерм. проверка имён (block) и относительной предыстории (warn) против пакета | доверие к `accuracy` судьи |
| **RP1** | первый eval-коммит Stage 3 | keyed-отчёты перезаписываются по имени → версия/timestamp в имени | аудит-след прогонов |
| **LT1** | Этап 3 (качество) | lore-остаток → `pack_version` 0.2.0; вместе с ним 2.3.c (токен-прокси) | не гейт Stage 2 (решение Ивана 27.09) |
| **C2** | Этап 3 (контент Ивана) | калибровка длин: opus 9/9 вне 400..800, sonnet 6/9 внутри | вход `R-activation(tone.md)` |
| **C4** | Этап 3 (контент Ивана) | эталонные ходы С пакетом; переписать G3 во втором лице; G3/G5 — не ходы | калибровочный набор |
| **DD-DICE-FACES** | Stage 3.2.b | сырые грани для UI-панели костей | только UI |
| **RV1** | content-gate | image-сверка `source_text` 4 карт (нужны сканы у владельца) | доверие к `verified:true` этих карт |

**Сдвинуто на этом хендоффе** (координатор по правилу гейта arch §9; **требует подтверждения
ревьюера**): **SD1 → «Закрыто»** (`29702db` → `6c4cd2c` → `61df2ce`/`5790ae5` → L4 на
`7d67954`); **MX1 → DUE Этап 4** (условие «если нарратив упрёт» в Stage 2 не сработало).
**GH1** (греческие гомоглифы в `mixed_script`) — DUE Этап 5.

**Watch:** **HC1** (создание героя) — DUE Этап 4, но «вероятно нужно в Этапе 3 (лист героя)»;
развилка 3.3 (по умолчанию держать готового/импортного героя, HC1 не тянуть в Stage 3).

---

## 7. Дисциплина (нерушимо)

- **verify-before-fix** — состояние проверяется **кодом** (тесты/grep/чтение файла) до правки, не
  по памяти. Числа из артефактов (напр. калибровка) берутся из реального файла, не из диалога.
- **Ключ только `env`**, артефакты с ключом/сырьём — **gitignored** (`calibration-report.json`,
  `full-cycle-report*`, `.env`); подтверждать `git check-ignore` перед коммитом.
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
  `keeper-smoke.mts`, `full-cycle.mts`). В корне workspace нет `tsx` (корневой `node_modules` —
  только `@brodyazhnik`); `npx tsx` из корня не найдёт локальный и предложит скачать из registry.
- **Каждая правка промпта судьи или `tone.md` → перепрогон 13 калибровочных кейсов**
  (`calibrate.mts`): `tone.md` дописывается в **ОБА** системных промпта (Хранителя и судьи).
- **`mixed_script` — детерминированный гейт (block)** в каждом потребителе `scanProse`; новые
  потребители получают его автоматически, отключать нельзя.
- **Аудит-след keyed-прогонов — `evals/l4-records/`** (закоммичен; провенанс в `README.md`).
  **Временное правило до `DEFERRED#RP1`:** перед следующим keyed-прогоном архивировать
  предыдущий отчёт в `evals/l4-records/` (или папку-преемника) **с версией в имени файла** —
  отчёты перезаписываются по имени (так потеряны сырые JSON калибровок v0.1/v0.2 и полного
  цикла v0.1; восстановлены только из stdout-захватов и копий Ивана).

---

## Следующее — Stage 3.1 (такт 1: скелет → «го» Ивана через ревьюера)

**Чат 3.1 — Каркас + API-контур** (`docs/ROADMAP_SESSIONS.md`):
- **3.1.a** scaffold `app/` (зарезервированный слот workspace) + PWA manifest / service worker;
- **3.1.b** серверный роут: движок + Хранитель за чистой границей — переиспользует
  `journeyTurn` / `renderNarrativePackage` (orchestrator), `AnthropicKeeper` за `Keeper`-швом;
- **3.1.c** схема Supabase (сессия / герой).
- **`TP1` — до живой многошаговой игры** (DUE 3.1.b); **`NF1` и `RP1`** — в первом
  eval-коммите Stage 3.

**НЕ начинать** 3.1 без явной отмашки Ивана; пуш — после сверки ревьюера.

---

## Первое сообщение нового чата CCD (рекомендация)

Сначала **ориентировка**: прочитать `CLAUDE.md` → `brodyazhnik-architecture-v1.md` →
`docs/ROADMAP_SESSIONS.md` → `docs/DEFERRED.md` → **этот файл** → последний коммит; подтвердить
порядок чтения, состояние (код-HEAD `7d67954` + docs-коммит, инварианты 394/36/89, typecheck
чист, Cyrillic CLEAN, pack 0.1.0; Stage 2 закрыт) и эхо-вывести DEFERRED с DUE ≤ Stage 3.
Задачу (**Stage 3.1**) давать **после** подтверждения ориентировки, тактом 1 (скелет), через
ревьюера.
