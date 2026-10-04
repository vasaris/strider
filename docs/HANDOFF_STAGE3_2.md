# HANDOFF_STAGE3_2 — вход в чат 3.2 (лента + кости + действия)

Точка входа для следующего чата CCD. Код-HEAD = **`a51a13d`** (3.1-C7), сверху — docs-коммит docs II
с этим файлом. Все факты ниже сверены по репо, по вердиктам ревьюера и по смоуку Ивана, не по памяти.

---

## 1. Процесс (новый с 03.10 — `CLAUDE.md` §«Процесс»)

- **А — одна проверка на чат** (полностью с 3.2): скелет 3.2 → «го» ревьюера → все коммиты чата →
  один `git archive` → ревью → push. Отдельные остановки — только для прогонов с ключом Ивана и
  необратимых действий. Роли: claude.ai — ревьюер, CCD — исполнитель, Иван — реле.
- **Б — строгость по риску.** Модель угроз: один пользователь, localhost, приватный контур; файлы
  репо (миграции, промпты, пак, конфиги) — доверенный вход. Реальные угрозы: чужая страница в
  браузере Ивана (CSRF / DNS-rebinding → трата кредитов Anthropic), утечка ключа или
  `DATABASE_URL`, порча собственных данных багом. Верификатор — не больше 2 раундов на коммит;
  в коммите — только баги корректности и находки по реальным угрозам; остальное — списком
  «В DEFERRED» в отчёте.
- **В — CCD пушит сам** после явного «CONFIRMED» в вердикте; в отчёт — вывод push и
  `git ls-remote origin refs/heads/main`.
- **Каждый код-коммит:** зелёные `test:all` / `typecheck:all` / `build:app`, кириллицы нет в
  `engine/src` и `orchestrator/src`, независимый верификатор; `git add` явно (пути Next с `[id]` —
  `git --literal-pathspecs add --pathspec-from-file=…`), `git commit -F`, ASCII.
- **Ключ:** только `process.env` в keyed-шелле Ивана; `.env` не читать; тесты офлайн (фейковый
  `LlmClient`); dev-сервер с ключом запускает только Иван.

## 2. Где мы (чат 3.1 закрыт целиком)

| Коммит | Что |
|---|---|
| `7610073` C5.0 | lock с кросс-платформенными optional-бинарниками; `tools/check-lock-platforms.mjs` — первый шаг `test:all` |
| `600c12f` C5 | `app/`: Next.js 16 (webpack + `experimental.extensionAlias`, R1 вариант B), `agentRules: false` (П14), PWA manifest + SW только install/activate, граница `server-only`, `/api/health` |
| `e9e288f` C5.1 | vitest `^4.1.11` во всех workspace, `npm audit` 0 (SEC-DEV1 закрыт) |
| `b687819` C6 | схема `brodyazhnik` (сессии, снимки ходов, генерации; П10 / П11 / П12, RLS без политик, append-only триггеры), свой раннер миграций (атомарность — `DO … EXECUTE` на стороне Postgres), роль `brodyazhnik_app` + `assertOrdinaryRole`, `SessionStore` memory + postgres, round-trip 11 сидов через jsonb |
| `a51a13d` C7 | API сессий и ходов: сервис с портами, П13 `pack_mismatch`, N1, DZ1 → 422, Host / Origin / JSON / лимит тела, 18 фиксированных кодов ошибок, редакция секретов (MF-1), кросс-гейт запросов Хранителя 11/11, `test:pg` |

**Инварианты на `a51a13d`:** `test:all` 394 / 84 / 201 / 425 (engine / orchestrator / evals /
app); typecheck чист; `build:app` зелёный; чекер lock — 8 нативных семейств / 122 optional;
`npm audit` 0; кириллицы нет в `engine/src` и `orchestrator/src`; `orchestrator/src` — чистый
ASCII; pack 0.1.0;
5 golden стабильны.

**Живые проверки на `a51a13d`:**
- ревьюер, Postgres 16: `db:migrate` applied → skipped, отказ суперпользователю, `test:pg` 65 / 65,
  ходы с 502 `keeper_failed` (ход сохранён), 409-ветки, Host / Origin / text/plain / 6 KB → 403 /
  403 / 415 / 413, регенерация, `delete` → BRD02, MF-1 — ключа нет ни в БД, ни в логах;
- смоук Ивана, Postgres.app, Хранитель `claude-sonnet-5`: сессия `border_lands`, ходы 0–2 → 201
  (проза 740 / 729 / 801), ходы 3–7 → 409 `journey_complete` без вызова Хранителя, регенерация
  хода 0 → 748, psql `1 | 3 | 4`, `delete from brodyazhnik.turns` → отказ append-only. По
  вердикту ревьюера, прочитавшего прозу смоука: «ты» без «вы» и без выдуманных имён; прибытие —
  «Восемь дней дорога тянула тебя»; ход 0 отражает потерянный день; ход 1 закрывается выбором из
  трёх путей. Сама проза смоука в репо не хранится.

## 3. Что готово для 3.2 — API для клиента

Маршруты сессий — `runtime = 'nodejs'`, тонкие, над `app/src/server/service/sessions.ts`; их
ответы — JSON с `Cache-Control: no-store` (`/api/health` — отдельный маршрут C5, проверка Host
добавлена в C7).

- `POST /api/sessions` `{ "region": "border_lands" | "wild_lands" | "dark_lands" }` → 201
  `{ session: { id, createdAt, rngSeed, heroRef, packId, packVersion, region }, nextTurnIndex: 0,
  journeyComplete: false }`.
- `GET /api/sessions/:id` → 200 `{ session, turns: [{ turnIndex, createdAt, pkg, prose,
  proseFailed, generations }], nextTurnIndex, journeyComplete, packCurrent }`.
- `POST /api/sessions/:id/turns` `{ "turnIndex": n }` → 201 `{ turnIndex, pkg, prose,
  generationId, nextTurnIndex, journeyComplete }` или 502 `keeper_failed` (ход сохранён, проза
  null) `{ error, turnIndex, nextTurnIndex, journeyComplete, pkg }`.
- `POST /api/sessions/:id/turns/:n/prose` (тело пустое или `{}`) → 201 `{ turnIndex, prose,
  generationId }` или 502 — регенерация из **сохранённого** `pkg`, движок не перезапускается.
- **Индексы с 0:** у новой сессии `nextTurnIndex = 0`; состояние до хода n — состояние хода n−1
  или `initial_state` сессии (arch §2.1).
- **Ошибки:** `{ error: { code, message } }` с фиксированными текстами (+ `nextTurnIndex` у
  `turn_conflict`, сохранённый ход у `keeper_failed`). Коды: 400 `invalid_request`; 403
  `forbidden_host`, `forbidden_origin`; 404 `not_found`, `session_not_found`, `turn_not_found`;
  409 `pack_mismatch`, `journey_complete`, `turn_conflict`; 413 `payload_too_large`; 415
  `unsupported_media_type`; 422 `unsupported_route`; 500 `internal_error`; 502 `keeper_failed`;
  503 `keeper_not_configured`, `database_not_configured`, `database_unavailable`,
  `database_misconfigured`.
- **Что есть в `pkg` для UI** (`orchestrator/src/contract.ts`): `dice` — проверка сцены
  (`feat_symbol`, `success_icons`, `total`, `target_number`, `outcome`); `journey` — `days_delta`,
  `arrived` / `days_total` на прибытии, `travel_check` (бросок Путешествия этого шага, не исход
  сцены); `oracle` (сцена пути и строка детали SD1); `detection`; `patch` (дельты трекеров). Сырые
  грани костей (`feat_die`, `success_dice`) пока `undefined` — `DD-DICE-FACES` (3.2.b; правка
  движка → golden-ревью). Сид сессии отдаётся в `session.rngSeed` (3.2.b «сид виден»).
- Герой — `pregen:wanderer@1`, маршрут — pregen 7 гексов без опасных зон (DZ1).

## 4. Ограничения для клиента (обязательно)

- **Страница и API — на одном хосте** (C7, отступление 8, принято ревьюером): Origin, если он
  есть, обязан совпадать с Host; `localhost` против `127.0.0.1` даст 403 `forbidden_origin`.
  Клиент зовёт относительные `/api/...` со своего же origin.
- Мутирующие запросы — `Content-Type: application/json`, тело ≤ 4 KiB, ровно ожидаемые ключи.
- **Только route handlers** (решение C7). Server Actions скан `test/boundary.test.ts` ловит лишь
  частично: внутри `src/server` — правилом (a) (первым должен идти `import 'server-only'`), через
  цепочку от `'use client'` — правилом (d); `'use server'`-модуль вне `src/server` с
  относительным импортом в `src/server` скан не видит. Типы для клиента — в общем модуле вне
  `src/server` (type-импорт из `src/server` в `'use client'`-модуле скан ловит).
- **frontend-design skill — обязательное чтение до любой вёрстки UI** (arch §6). Тёмная тема,
  типографика под чтение, визуальный язык React-трекеров Ивана; тексты интерфейса — по-русски.
- Service worker — без `fetch` и кэша; офлайн — 3.4.b.

## 5. План чата 3.2 (roadmap; скелет — первым)

- **3.2.a** Лента хода · **3.2.b** Отображение бросков (сид виден; `DD-DICE-FACES`) · **3.2.c**
  Ввод → ход → рендер + **`LG1`** (живой гейт прозы в роуте), **`SA1`** (соло-адресация),
  **`API-RES1`** (устойчивость роута хода).
- **Вопросы к скелету 3.2:**
  1. Межходовая непрерывность (watch ниже): в 3.2.c или отдельным пунктом реестра с DUE?
  2. `LG1`: где жить сканерам (app не зависит от evals: отдельный пакет или orchestrator с
     кириллицей как данными) и политика для прозы, уронившей block-проверку (показать / скрыть /
     перегенерировать с лимитом); как это видит игрок.
  3. `API-RES1`: UI-состояние «ход без прозы», таймаут и ретраи вызова Хранителя, дедупликация
     регенерации.
  4. `DD-DICE-FACES`: тянуть ли сырые грани в 3.2.b (правка движка → golden-ревью) или панель
     костей показывает исход / символ / ЦЧ без граней.

## 6. Watch (не реестр)

- **Межходовая непрерывность** (смоук): каждый ход Хранитель пишет, не видя предыдущего
  (`journal_facts` пуст). Повтор мотива — «ноги гудели от долгого хождения кругами» (ход 0) и
  «ноги гудят от хождения по кругу» (ход 1); скачок времени — ход 0 кончается у вечернего костра,
  ход 1 подан как дневной. В ленте 3.2 это станет видно игроку. Решение — журнал / сжатие
  контекста (arch §2.4); решить при скелете 3.2.
- Длины (`C2`): проза смоука 740 / 729 / 801 — одна чуть выше 800.
- W1–W4 прогона 3.1 — `docs/CALIBRATION_TONE_JUDGE.md` §«3.1, 27.09».
- Фикстура `evals/test/fixtures/keeper-requests.v0.3.json` — теперь кросс-потребительский гейт
  (evals и app): любое намеренное изменение запроса Хранителя = новая версия фикстуры.

## 7. Открытые DEFERRED с DUE ≤ Stage 3 (эхо после docs II)

| Пункт | DUE | Суть |
|---|---|---|
| `LT1` | Этап 3 (качество) | lore-остаток → pack 0.2.0; токен-прокси |
| `C2` | Этап 3 (Иван) | калибровка длин по типу сцены |
| `C4` | Этап 3 (Иван) | эталонные ходы с пакетом; G3 во втором лице |
| `DD-DICE-FACES` | 3.2.b | сырые грани для UI-панели костей |
| `LG1` | 3.2.c | живой гейт прозы в роуте |
| `SA1` | 3.2.c | обращение к герою на «вы» / выдуманный спутник |
| `API-RES1` | 3.2.c | ход без генерации, таймаут / ретраи Хранителя, дубли регенерации |
| `AUTH1` | 3.4.b | вход по доступу до любой не-localhost экспозиции |
| `DB-ROLES1` | 3.4.b | роль-владелец только для миграций + рантайм-роль |
| `SEC-RED1` | 3.4.b | редакция секретов и мелкие защиты API |
| `NODE1` | 3.4.b | `engines` / `.nvmrc` |
| `RV1` | content-gate | image-сверка 4 карт |
| `SUPA1` | до переезда на Supabase | права и экспозиция схемы |

Этап 4: `DZ1`, `O1`, `D1`, `HC1`, `FV1`, `MX1`, `TR1`, `PT1`. Этап 5: `GH1`.

## 8. Как запускать (Иван)

- БД один раз — `app/supabase/README.md` (роль `brodyazhnik_app`, база `brodyazhnik`), затем
  `npm run db:migrate -w app` с `DATABASE_URL` в шелле.
- Dev: keyed-шелл (`set -a; source evals/.env; set +a`) + `DATABASE_URL` → `npm run dev -w app`
  (http://127.0.0.1:3000).
- Опционально: `npm run test:pg -w app` с `TEST_DATABASE_URL` на базу `*_test` (вне `test:all`).
- `test:all` поднимает свой `next dev` для `app/` — запущенного dev-сервера app в этот момент быть
  не должно.
