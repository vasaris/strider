# API приложения — живой справочник

Обзор HTTP-контура `app/` для клиента и для следующих чатов. Канон — код: формы ответов —
`app/src/shared/api.ts` (типы провода; обработчики сверяют ответы с ними через `satisfies`), коды
и тексты ошибок — `app/src/server/http/errors.ts` (`API_ERRORS`), порядок проверок и правила
выбора прозы — шапка `app/src/server/service/sessions.ts`. При расхождении главнее код; этот файл
правится вместе с ним. Состояние — чат 3.2, коммит `51777dd`.

## Общие правила

- Только route handlers (`runtime = 'nodejs'`), Server Actions нет. Клиент зовёт относительные
  `/api/...` со своего же origin: страница и API — на одном хосте (`127.0.0.1` против `localhost`
  даст 403 `forbidden_origin`).
- Host из allowlist — на всех `/api/*` (DNS rebinding). Мутирующие запросы: Origin, если есть,
  равен Host; `Content-Type: application/json`; тело ≤ 4 KiB; ровно ожидаемые ключи.
- Ответы маршрутов сессий — JSON с `Cache-Control: no-store` (`/api/health` — без этого заголовка).
- Ошибка — `{ error: { code, message } }` плюс документированные поля кода. `message` фиксирован
  (английский) и не несёт внутренних текстов; русские сообщения игроку клиент берёт по `code`
  (`app/src/ui/model.ts`).
- Индексы ходов — с 0: у новой сессии `nextTurnIndex = 0` (arch §2.1).

## Маршруты

| Метод и путь | Тело запроса | Успех |
|---|---|---|
| `GET /api/health` | — | 200 `{ ok: true, pack: { id, version } }`; пак не грузится → 503 `{ ok: false, error: 'pack_unavailable' }` |
| `POST /api/sessions` | `{ region }`: `border_lands` / `wild_lands` / `dark_lands` | 201 `{ session, nextTurnIndex: 0, journeyComplete: false }` |
| `GET /api/sessions` | — | 200 `{ sessions: [{ session, nextTurnIndex, journeyComplete }] }` — 20 последних (`created_at desc, id desc`) |
| `GET /api/sessions/:id` | — | 200 `{ session, turns, labels, nextTurnIndex, journeyComplete, packCurrent }` |
| `POST /api/sessions/:id/turns` | `{ turnIndex }` | 201 `{ turnIndex, pkg, labels, prose, proseState, gate, generationId, nextTurnIndex, journeyComplete }` |
| `POST /api/sessions/:id/turns/:n/prose` | пустое или `{}` | 201 `{ turnIndex, prose, proseState, gate, generationId }` |

`session` — `{ id, createdAt, rngSeed, heroRef, packId, packVersion, region }`. `packCurrent: false` —
сессия начата на другой версии пака: ходы и регенерация отвечают 409 `pack_mismatch` (P13), читать
можно.

## Ход в ленте (`turns[]` в GET сессии)

`{ turnIndex, createdAt, pkg, prose, proseState, gate, generating, generations }`:

- `proseState` — `ready` / `blocked` / `failed` / `missing` (правило ниже);
- `prose` — текст последней принятой генерации, иначе `null`. Текст заблокированной генерации не
  отдаёт ни один маршрут (F3);
- `gate` — `[{ list, term, severity }]`: замечания показанной генерации (warn) или последней
  заблокированной (block + warn);
- `generating` — держится lock генерации этого хода (клиент опрашивает GET раз в 3 с);
- `generations` — число генераций хода.

Правило выбора, по генерациям хода в порядке создания:

1. последняя генерация, прошедшая гейт (без block) → `ready`, её текст и её warn; более поздние
   сбой или блок её не прячут;
2. генераций нет → `missing`, `gate: []`;
3. иначе последняя генерация — ошибка Хранителя → `failed`, иначе (заблокирована) → `blocked`;
   `prose: null`.

Вердикт гейта не хранится: считается при записи и при каждом чтении (R3), поэтому ужесточённый
стоп-лист скрывает и уже сохранённую прозу.

`pkg` — `NarrativePackage` (`orchestrator/src/contract.ts`). Для панели костей в `dice` и
`journey.travel_check` есть поля только для UI: `feat_die`, `success_dice`, `feat_candidates`,
`feat_modifier`, `success_counted` (K1). Хранителю и судье они не рендерятся. В пакетах,
сохранённых до K1, их нет.

## Ход и регенерация

Перед всеми проверками сервиса — HTTP-слой: Host (403 `forbidden_host`), Origin (403
`forbidden_origin`), `Content-Type` (415), размер тела (413), формат тела (400); `:id`, который не
uuid, — 404 `session_not_found`; неверный `:n` — 400 `invalid_request`.

**`POST …/turns`**, проверки по порядку:

1. ключ — 503 `keeper_not_configured`;
2. сборка Хранителя — 503 `keeper_not_configured`;
3. БД — 503 `database_*`;
4. сессия — 404 `session_not_found`;
5. P13 — 409 `pack_mismatch`;
6. **lock генерации** `(id, n)` — 409 `generation_in_progress`;
7. путь окончен — 409 `journey_complete`;
8. индекс равен `nextTurnIndex` — иначе 409 `turn_conflict` + `nextTurnIndex`;
9. шаг движка — 422 `unsupported_route` (DZ1);
10. запись хода (дубль из другого процесса — 409 `turn_conflict` + `nextTurnIndex`);
11. Хранитель;
12. вырезание U+0000;
13. гейт;
14. запись генерации;
15. 201.

Исходы, отличные от обычного 201:

- **Сбой Хранителя** — 502 `keeper_failed` `{ error, turnIndex, nextTurnIndex, journeyComplete, pkg }`: ход сохранён без прозы.
- **Генерация не записалась** после успешного вызова Хранителя — 201 с `prose: null`, `proseState: 'missing'`, `generationId: null`.

**Отступление K4 (2).** Lock берётся сразу после P13, до проверок «путь окончен» и индекса. Поэтому
параллельный дубль того же хода получает **409 `generation_in_progress`**, а не `turn_conflict`.
`turn_conflict` остаётся для устаревшего индекса и для дубля из другого процесса на вставке хода.

**`POST …/turns/:n/prose`** — регенерация из **сохранённого** пакета, движок не перезапускается.
Проверки: ключ → сборка Хранителя → БД → сессия (404) → P13 (409) → ход (404 `turn_not_found`) →
тот же lock (409 `generation_in_progress`) → Хранитель → U+0000 → гейт → запись генерации → 201,
или 502 `keeper_failed` `{ error, turnIndex }`.

**Отступление K4 (1).** Ответ регенерации — исход **этой** генерации. Заблокированная регенерация
отвечает `prose: null, proseState: 'blocked'`, хотя GET продолжает показывать прежний принятый
текст. Клиент после любого POST перечитывает GET (единственный источник правды). Если переписывали
принятый текст, а новый вариант заблокирован или не записан, клиент показывает уведомление
«оставлен прежний текст» (K5.1).

**Транспорт Хранителя** (API-RES1):
- таймаут 90 с на попытку, 1 повтор (`KEEPER_TIMEOUT_MS`, `KEEPER_MAX_RETRIES` в `app/src/server/service/keeper.ts`);
- lock — в памяти одного процесса (`DEFERRED.md#LOCK1`).

**Телеметрия (K5.2).** На каждый вызов Хранителя в серверный лог пишется одна строка
`keeper_call {...}`:
- `model`, `duration_ms`, `ok`;
- при успехе — `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`) и `stop_reason`;
- при сбое — `error`: для ошибок SDK — класс фиксированным именем (`APIConnectionTimeoutError`,
  `APIConnectionError`, `APIUserAbortError`, `APIError`), для прочих — их `name`; плюс HTTP-статус,
  если у ошибки есть целочисленный `status`.

В строку не попадают проза, текст запроса, ключ, заголовки и текст ошибки. Это базовая линия для
`DEFERRED.md#LAT1`.

## Подписи (`labels`)

Группы:

| Группа | Что подписывает |
|---|---|
| `scenes` | типы сцен пути |
| `skills` | навыки |
| `conditions` | состояния |
| `outcomes` | степени успеха и провал |
| `regions` | регион сессии |
| `trackers` | дельты трекеров |
| `rolls` | благополучный / злополучный бросок |
| `roles` | Хранитель |

Сервер присылает подписи ровно для id, которые показывают пакеты ответа, плюс регион сессии и все
роли (`ROLE_IDS`). Источники по порядку:
1. структурное имя пака;
2. сайдкар `content-packs/kv/ui_labels.json` (`verified: true`; у каждой записи evidence из
   verified-карты, проверяется при загрузке каталога и тестом);
3. сам id.

В коде app нет ни одного имени сеттинга литералом. Главная `/` получает названия регионов на
сервере в момент запроса (динамическая страница).

## Коды ошибок (19)

| Статус | Коды |
|---|---|
| 400 | `invalid_request` |
| 403 | `forbidden_host`, `forbidden_origin` |
| 404 | `not_found`, `session_not_found`, `turn_not_found` |
| 409 | `pack_mismatch`, `journey_complete`, `turn_conflict` (+ `nextTurnIndex`), `generation_in_progress` |
| 413 | `payload_too_large` |
| 415 | `unsupported_media_type` |
| 422 | `unsupported_route` |
| 500 | `internal_error` |
| 502 | `keeper_failed` (+ сохранённый ход) |
| 503 | `keeper_not_configured`, `database_not_configured`, `database_unavailable`, `database_misconfigured` |
