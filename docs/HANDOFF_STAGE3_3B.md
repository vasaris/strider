# HANDOFF_STAGE3_3B — вход в чат 3.3b («Интерактивный ход в app»)

Точка входа для следующего чата CCD. Код-HEAD = **`98cb553`** (3.3a-K4), сверху — docs-коммит K5 с этим
файлом. Факты ниже сверены по репо, по вердиктам ревьюера и верификаторов, по прогону тактов Ивана 05.10.

---

## 1. Процесс

- **А / Б / В** — без изменений, см. `CLAUDE.md` §«Процесс». Цикл чата: скелет → «го» ревьюера → все коммиты →
  один `git archive` → ревью → push только после CONFIRMED. **Строго последовательно.**
- **Каждый код-коммит:** зелёные `test:all` / `typecheck:all` / `build:app`; кириллицы нет в `engine/src` и
  `orchestrator/src`; независимый верификатор, не больше 2 раундов; `git add` явно; `git commit -F`; ASCII.
- **Опыт 3.3a:**
  - Mac засыпает: долгие прогоны (тесты, keyed) обрываются, `next dev` в тестах app «висит». Перед долгим
    прогоном — `caffeinate -i`; при «зависшем» тесте app сначала проверить `ps` на осиротевшие
    `next` / `vitest` и сон машины, потом искать в коде.
  - Длинные сессии агентов зависали на 600 с: задания резать на части (K4 сделан как K4a / K4b), полные
    гейты гонять в основной сессии, верификатору давать пробы без `test:all`.
- **Ключ** — только `process.env` в keyed-шелле Ивана; dev-сервер с ключом запускает только Иван.

## 2. Где мы (чат 3.3a закрыт)

| Коммит | Что |
|---|---|
| `4224402` K1 | такты в движке: `travelBeat` / `checkBeat` (игрок бросает Испытание похода и проверку сцены), Надежда (до броска; состояния после траты; не больше 1; вдохновение Странника), `previewCheck` (точные шансы перебором), `askOracle`; **R2** — Око только за Око на проверке героя; Изнурение в конце пути — только при успехе (КВ 111, в цикл не встроено — `ENDFAT1`) |
| `e757d3e` K2 | пакеты тактов: `beat` в `## turn`, `## player`, `## questions`, `## previous`; только для UI — `rolls`, `eye_sources`; `travelBeatTurn` / `checkBeatTurn` / `oracleAnswer`; `travel_check` опционален; три строки типов в `app/src` (отступление принято ревьюером) |
| `5eabff5` K3 | стриминг Хранителя (`LlmClient.stream?`, `AnthropicLlmClient.stream`, `AnthropicKeeper.runStream`, `ttft_ms`); `createSentenceRelease` (выдача по предложениям за гейтом, `LIST_MONOTONE`); SA2 — граница слова |
| `98cb553` K4 | keeper v0.4 (§8 «Такты»; правило 6 — имена из слов игрока и прошлой прозы), фикстура запросов v0.4 (20 тактов), скриптовый игрок, `full-cycle.mts --beats` |
| K5 | docs: реестр, arch §9, ROADMAP, `CLAUDE.md`, запись калибровки, аудит-след прогона, этот файл |

**Инварианты на `98cb553`:** `test:all` 431 / 145 / 160 / 128 / 554 (engine / orchestrator / prose-gate / evals /
app); typecheck чист; `build:app` зелёный; кириллицы нет; 5 golden байт-в-байт; снимок 900 прогонов
(`engine/test/journey/snapshot900*`); фикстуры запросов Хранителя v0.3 (11) и v0.4 (20); NF1-реплей 2 / 10;
живой гейт на корпусе 58 — 5 block / 2 SA1-warn; `npm audit` 0; pack 0.1.0.

**Прогон тактов 05.10** (`claude-sonnet-5`, судья `claude-opus-4-8`; `evals/records/beats-cycle-report.*`;
запись — `docs/CALIBRATION_TONE_JUDGE.md` §«3.3a»): setup 86.9 (9/9), resolution 84.1 (8/9), arrival 86,
encounter 88; 1 блок (NF1 «Врага», единичный — `BEAT1` (1)); ни одна завязка не описывает исход и не решает
за игрока; TTFT — медиана 10,8 с, из них около 76 % — размышление модели (`LAT1`). v0.4 не правился.

## 3. Что есть в коде (опора для 3.3b)

- **Движок** (`engine/src/journey/`):
  - `travelBeat(state, { hopeSpend }, cfg)` → `TravelBeatRecord { kind: arrival | pending | encounter, events,
    travelCheck, travelRoll, hope { spent, bonusDice }, scene: SceneDraw | null, eyeSources }`;
  - `checkBeat(state, { hopeSpend }, cfg)` → `CheckBeatRecord`; `askOracle(state, { likelihood }, cfg)` →
    `OracleRecord` (событие `oracle` без текста вопроса; Око не растёт);
  - `JourneyProgress.pending` — сцена, ждущая проверки (только JSON; ключа нет ≡ null);
  - `JourneyBeatError(code)`: `journey_over` / `check_pending` / `no_pending`;
  - `previewCheck(hero, skill, cfg)` → `CheckPreview` (навык, рейтинг, характеристика, ЦЧ, модификатор с
    причиной, вдохновение, Надежда { current, max, canSpend, bonusDice }, Усталость, Несчастье сейчас /
    после траты, шансы { base, withHope }); `TRAVEL_SKILL`.
  - `stepJourney` = `travelBeat(0)` [+ `checkBeat(0)`]: прежние RNG, состояние и `StepRecord`.
- **Оркестратор:** `travelBeatTurn` / `checkBeatTurn` / `oracleAnswer` (`orchestrator/src/beats.ts`) с
  `BeatContext { previousProse, questions, approach }` — контекст держит вызывающий; длины тактов —
  `PROVISIONAL_BEAT_LENGTH` (setup 200–400, resolution 300–600, arrival 300–600, encounter 400–800);
  `AnthropicKeeper.runStream`; телеметрия `onCall` с `ttft_ms`.
- **prose-gate:** `createSentenceRelease(vk, pkg)` → `push(delta)` (выданные предложения) /
  `finish()` → `{ verdict, released, stoppedAt }`; `splitSentences`.
- **evals:** `beatScript.ts` (скриптовый игрок), `beatCycle.ts`, `full-cycle.mts --beats`; фикстура
  `evals/test/fixtures/keeper-requests.v0.4.json` — кросс-гейт запросов (как v0.3: тест app читает её как данные).
- **app:** без изменений поведения; Хранитель app — на keeper v0.3 (`KEEPER_PROMPT`), целым шагом.

## 4. Решения, зафиксированные для 3.3b

- **Персистентность (решение ревьюера 9):** такт = строка `turns`, индекс сквозной; вид такта — `pkg.beat`
  (поля нет = шаг 3.2); ввод игрока — в `pkg` (`player`, `questions`); `pending` — в состоянии
  (`journey.pending`). **Без миграции.**
- **Непрерывность (CT1, закрыт):** развязке — принятая проза завязки своего шага; первому такту шага — принятая
  проза последнего такта прошлого шага; вперёд идёт только текст, прошедший гейт. Выбирает сервер.
- **Вопрос оракулу:** без вызова Хранителя, мгновенно; ответ хранится и вплетается первым следующим тактом с
  прозой; только пока путь не окончен. Вопрос сдвигает следующие броски (один поток RNG) — так задумано.
- **Смена параметров запроса Хранителя** (размышление, effort, модель) — только через eval (прогон тактов).

## 5. Рамка 3.3b (ревьюер)

- **API:**
  - `POST /turns` по виду действия: `travel` | `check` | `oracle`; ровно ожидаемые ключи; тело ≤ 4 KiB;
    `approach` ≤ 300, вопрос ≤ 200;
  - ответ потоком: `beat` → `delta*` → `done` | `error`; оракул — мгновенный JSON;
  - `GET` отдаёт `nextAction` и `CheckPreview`.
- **UI:** панель броска, анимация (с `prefers-reduced-motion`), карточка сцены (`TRANS1`), источники Ока, форма
  вопроса оракулу, поток прозы.
- **Реестр:** `TERM1` (сайдкар + подпись Ивана), `UI1`, `API-RES2`, связь `keeper_call` с сессией и тактом;
  плюс `TRANS1`, `LAT1`, `SA2`, `BEAT1` (DUE 3.3b).

## 6. Что учесть в скелете 3.3b (заметки верификаций и разбора 3.3a)

- **Проверки до движка.** `hope_spent: 1` при `previewCheck(...).hope.canSpend === false` отклонять до вызова
  движка (движок молча обрежет трату до 0, а RNG уже сдвинется). Неизвестную вероятность сверять с паком до
  `askOracle` (движок бросит обычный `Error`). `JourneyBeatError` (`journey_over` / `check_pending` /
  `no_pending`) — отобразить в фиксированные коды API; `stepJourney` / `journeyTurn` на состоянии с открытой
  сценой бросают `check_pending`.
- **Выдача и блок.** Игрок увидит чистые предложения до блока (в прогоне: 412 из 649 знаков), а итоговый
  вердикт такта — block. Политика LG1 / F3 («проза с блоком скрыта») против уже показанного префикса —
  решить в скелете. `finish()` не возвращает хвост отдельным предложением: хвост = `released.slice(выдано)`.
  `push()` после `finish()` и повторный `finish()` бросают.
- **Два источника текста при стриминге:** дельты (их видит выдача) и `finalMessage` (его возвращает
  `runStream`). С SDK они совпадают, но код этого не проверяет — хранить то, что видела выдача, или сверять.
- **Пакеты:** строить их только производителями оркестратора — рендер сам по себе пустой
  `previous_prose: ''` не отбрасывает. Имя `questions` в пакете (ответы оракула) совпадает с
  `KeeperOutput.questions` (уточняющие вопросы Хранителя) — развести в API и UI.
- **Телеметрия:** `keeperCallLine` в app не пишет `ttft_ms`; пробелы `LAT1` (связь с сессией и тактом, повтор
  SDK, типы блоков и токены размышления).
- **Промпт:** формулировка §8 «как в §3 и §4» для arrival / encounter расплывчата (ревьюер: не трогать без
  провала; учесть при первой итерации промпта); находки прогона — `BEAT1`.
- **Комментарии «3.4.b»** в `app/public/sw.js`, `app/src/server/http/guard.ts`, `app/src/server/service/deps.ts`,
  `app/src/server/service/lock.ts`, `app/test/sw.test.ts` читать как 3.5.b — поправить при первом касании.
- **Тест app** `app/test/service/uiLabels.test.ts` ищет в исходнике `orchestrator/src/provider.ts` вызовы
  `gained.push(...)` — хрупкая связка (держится, пока `diffHeroState` там).

## 7. Ограничения для клиента (без изменений)

- Страница и API — на одном хосте. Мутирующие запросы — `application/json`, тело ≤ 4 KiB, ровно ожидаемые
  ключи. Только route handlers.
- `'use client'` не импортирует `@brodyazhnik/*` и `src/server`; общие типы — в `app/src/shared`; граница —
  `app/test/boundary.test.ts`.
- **Ни одного имени сеттинга литералом в `app/src`.** Новые термины панели броска — через сайдкар
  `ui_labels.json` с evidence и подписью Ивана (`TERM1`).
- Анимация — только CSS, с `prefers-reduced-motion`. Service worker — без `fetch` и кэша (офлайн — 3.5.b).

## 8. Watch (не реестр)

- Время повествования: настоящее в 4/20 тактах (`BEAT1` (4)) — проверить на живом корпусе.
- Длины тактов выше цели (setup 5/9, resolution 3/9) — `C2`.
- Сессии, начатые до 3.3b, — целые шаги v0.3: UI должен показывать их как раньше (поля `beat` нет).

## 9. Открытые DEFERRED с DUE ≤ Stage 3 (эхо после K5)

| Пункт | DUE | Суть |
|---|---|---|
| `LT1` | Этап 3 (качество) | lore-остаток → pack 0.2.0; токен-прокси |
| `C2` | Этап 3 (Иван) | калибровка длин по типу сцены и такта |
| `C4` | Этап 3 (Иван) | эталонные ходы с пакетом; G3 во втором лице |
| `TRANS1` | 3.3b | бросок таблицы сцен и источники Ока — UI (данные готовы) |
| `LAT1` | 3.3b | стриминг в app; рычаги размышления — через eval |
| `TERM1` | 3.3b | наши слова UI против канон-терминов |
| `SA2` | 3.3b | остаток пределов SA1 по живому корпусу |
| `API-RES2` | 3.3b | остаток устойчивости роута хода |
| `UI1` | 3.3b | мелочи UI |
| `BEAT1` | 3.3b | находки прогона тактов keeper v0.4 |
| `FAV1` | 3.4 | любимые навыки → благополучный бросок |
| `ENDFAT1` | 3.4 | бросок СТРАНСТВИЯ в конце пути в цикле хода |
| `ADV1` | 3.4 | числа продвижения по гексам — из пака |
| `AUTH1` | 3.5.b | вход по доступу до любой не-localhost экспозиции |
| `DB-ROLES1` | 3.5.b | роль-владелец только для миграций + рантайм-роль |
| `SEC-RED1` | 3.5.b | редакция секретов и мелкие защиты API |
| `NODE1` | 3.5.b | `engines` / `.nvmrc` |
| `LOCK1` | 3.5.b | lock генерации между процессами |
| `RV1` | content-gate | image-сверка 4 карт |
| `SUPA1` | до переезда на Supabase | права и экспозиция схемы |

Этап 4: `DZ1`, `O1`, `D1`, `HC1`, `FV1`, `MX1`, `TR1`, `PT1`, `IC1`, `WEARY1`, `LUCK1`, `SS1`, `SE1`, `ORC2`,
`TERR1`. Этап 5: `GH1`, `LBL1`. Закрыты в 3.3a: `CT1`, решение `R2`.

## 10. Как запускать (Иван)

- БД один раз — `app/supabase/README.md`, затем `npm run db:migrate -w app` с `DATABASE_URL` в шелле.
- Dev: keyed-шелл (`set -a; source evals/.env; set +a`) + `DATABASE_URL` → `npm run dev -w app`,
  http://127.0.0.1:3000; строки `keeper_call {...}` — латентность и токены каждого вызова Хранителя.
- Прогон тактов: `cd evals && KEEPER_MODEL=claude-sonnet-5 caffeinate -i npx tsx full-cycle.mts --beats`
  (40 вызовов; отчёт `evals/beats-cycle-report.*`, в корпус 58 не входит).
- Перед `test:all` / `build:app` dev-сервер остановить (`lsof -i :3000` пуст).
