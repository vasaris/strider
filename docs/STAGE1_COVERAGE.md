# STAGE 1 COVERAGE — матрица охвата книга/пак → движок

Доказательный аудит закрытия Stage 1. Канон «что за механики в скоупе» — это
верифицированный пак (Stage 0 закрыл извлечение книга→пак): 222 файла =
189 mechanics-карт (КВ-ядро) + 25 solo-таблиц (ИдО) + 8 жизненных путей.
Метод: для каждого домена пака установлено, потребляет ли его движок
(`grep -roE '"kv\.[...]"' engine/src`), и каждая непотреблённая карта
классифицирована по сути (не «непотреблено = пробел»).

Легенда статусов:
- **ENGINE** — счётная механика, есть верифицированный потребитель в движке.
- **DEFERRED#id** — отложено, заведено в `DEFERRED.md`, гейтится roadmap-строкой.
- **NARRATIVE** — проза/правила для LLM-Хранителя (Stage 2); движок их не считает по дизайну.
- **UI** — лист/карта (Stage 3).
- **CONTENT** — content-discipline (ревью), не движок.

---

## Принципиально-критичные проверки (анти-хардкод)

Эти проверены отдельно, т.к. хардкод тут нарушил бы нерушимый принцип:

| Что | Вердикт | Источник в паке |
|---|---|---|
| Целевое число (ЦЧ) | ENGINE, не хардкод | `targetNumber.ts` = `tnBase − attribute`; `tnBase` (18) из `kv.solo.hero_adjustments.target_number_base` |
| Cap баллов Тени | ENGINE, не хардкод | `conditions/config.ts` ← `kv.mechanics.shadow.bally_teni.shadow_points.cap = max_hope_rating` |
| Безумие / braceSpirit | ENGINE | `conditions/shadow.ts` (`boutOfMadness`, `braceSpirit`) |
| Доблесть/Мудрость (рост) | ENGINE | `progression/config.ts` (`valourWisdomByNewLevel`, `valour_or_wisdom_per_phase`, training_cost) |
| Преследование Ока | ENGINE | `eye/pursuit.ts` ← `eye_of_mordor.pursuit_thresholds` по регионам |

---

## Матрица по доменам

| Домен (карт) | Статус | Заметка / потребитель |
|---|---|---|
| checks (19) | **ENGINE** | evaluator + `targetNumber` + degree/special; счётные параметры из `dice_set`, `feat/success_die_values`, `procedure`, `degree_of_success`, `hero_adjustments`. Непотреблённые (`who_rolls`, `when_required`, `scene_structure`, `which_ability`, `retry`, `magical_success`…) — **NARRATIVE** (процедурная проза) |
| dice / RNG | **ENGINE** | sfc32+cyrb128; грани из `checks.feat_die_values`/`success_die_values` |
| eye (3) + pursuit | **ENGINE** | `eye/` ← `kv.solo.eye_of_mordor`; core-карты `bditelnost_oka`/`oko_mordora`/`presledovanie` — NARRATIVE-дубль прозы (числа в solo-карте) |
| conditions (4) | **ENGINE** | weary/miserable/overwhelmed; `overview` — NARRATIVE |
| shadow (5) | **ENGINE** | `bally_teni` (cap), `ispolzovanie_izyanov` (путь Тени). `istochniki_teni` — список источников; суммы прироста принадлежат вызывающим подсистемам. `ten`/`bezumie` core — NARRATIVE-проза (механика безумия в коде) |
| endurance_hope (3) | **ENGINE** | `vynoslivost`; Надежда через `checks.bonus_dice_hope`. `nadezhda`/overview — NARRATIVE |
| journey (6) | **ENGINE** | `poryadok_puteshestviya` (формула длительности/усталости; golden `dark-1`→8). `karta` — **UI**; описания/разыгрывание сцен — NARRATIVE |
| combat melee (9) | **ENGINE** (кроме FV1) | атаки/раны/задачи/выход/осложнения + adversary derive + special damage + wounds. `nachalo_boya`/`posledovatelnost_boya` → **DEFERRED#FV1**; `boy` — NARRATIVE |
| council (3) | **ENGINE** | introduction/negotiation/resolve/`zavershenie`. `sovet`/`sotsialnoe_vzaimodeystvie` — NARRATIVE |
| progression | **ENGINE** | `experience` + training costs + valour/wisdom + shadow path |
| fellowship_phase (4) | **ENGINE** | struktura/nachinaniya/yol + recovery; **эффекты начинаний отложены** (валидируются+записываются). `kak_ustroena…` — NARRATIVE |
| oracles (solo tables 25) | **ENGINE** | 12 таблиц катятся движком (answers/lore/luck/misfortune/journey_scenes/detection_scenes/milestones/special_successes/risk_degrees/shadow_recovery/hero_adjustments + manevr) |
| adversaries (7) | **ENGINE** | `deriveEnemyStatBlock` универсален; orki — demo; volki/trolli/nezhit/nedobrye — данные под тот же потребитель; `format_opisaniya` — схема |
| traits (7) | **ENGINE** | `spisok_navykov` (навык→характеристика), `spisok_boevyh_umeniy`. Навыки/категории/отличит. качества — данные создания (HC1) + NARRATIVE (opaque) |
| rewards_virtues (11) | **ENGINE** (приобретение) | списки наград/особенностей; эффекты opaque по дизайну; per-culture — данные создания/прогрессии |
| solo combat overlays | **ENGINE** | `prodvinutsya`, `manevrennaya_poziciya_dalniy_boy` |
| equipment (3) | **DEFERRED#HC1** | таблицы оружия/брони/снаряжения — потребитель появляется при создании героя/лоадауте |
| hero_creation (38) + lifepaths (8) | **DEFERRED#HC1** | весь конвейер генерации без потребителя; `experience` — единственная потреблённая |
| treasure (8) | **DEFERRED#TR1** | сокровища/знаменитое оружие/проклятые/клады/артефакты/создание — 0 движка |
| patron_tasks (solo) | **DEFERRED#PT1** | задачи покровителей (cirdan/gandalf/balin/… ) не катятся движком |
| scene_details (solo) | **DEFERRED#SD1** | под-таблицы деталей сцен (despair/mishap/chance_meeting/…) — второй уровень оракульного броска |
| standard_of_living (3) | **DEFERRED** (с эффектами начинаний/TR1) | накопление богатства / образ жизни — экономика, привязана к отложенным эффектам Фазы братства |
| keeper_tools (2) | **NARRATIVE** | как устроена Фаза приключений / сессии — GM-проза; в соло заменяется оракулом+нарративом |
| reference (3) | **NARRATIVE / UI** | game_terms/procedure_steps — глоссарий; `character_sheet` — UI (Stage 3) |
| solo prose (~40) | **NARRATIVE** | osnovnaya_ideya/chto_takoe/srazhayas_s_soboy/bezopasnoe_mesto/… — проза ИдО для Хранителя (Stage 2) |

---

## Итог аудита

- **Stage 1 по критерию документа** («CLI-прохождение путешествия без LLM») —
  закрыт; гейт зелёный (journey golden + CLI).
- **Все подсистемы, заявленные сделанными,** подтверждены потреблением пака и
  прошли анти-хардкод проверки на принципиально-критичных точках (ЦЧ, Тень,
  безумие, доблесть/мудрость, преследование).
- **Известные пробелы** — HC1, FV1, MX1 — на месте в реестре, гейтятся.
- **Аудит выявил новое** (не было ни в одном плане): **TR1** (сокровища),
  **PT1** (задачи покровителей), **SD1** (под-таблицы деталей сцен). Все —
  поздне-этапные/нарративные, ни один не блокирует Stage 2; занесены в реестр.
- **Неизвестные пробелы за пределами этого списка** не выявлены в пределах пака.
  Оговорка честности: аудит сверял движок против **пака** (канон скоупа), а не
  построчно против сырых книг — полнота пака против книг была работой Stage 0
  (закрыта там); если в паке чего-то нет, этот аудит этого не увидит.

Вывод: Stage 1 закрывается на доказательстве. Остаток — это сознательно
отложенные поздне-этапные подсистемы в реестре с гейтом, а не забытые хвосты.
