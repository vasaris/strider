# Gate-2a (semantic) — КВ-ядро (140 карт) — FINDINGS

**Ревьюерская сессия** (ADR-001: автор ≠ ревьюер). Документ — **запись вердиктов**, произведён фреш-инстансом, который эти карты НЕ строил. Все суждения вынесены **по книге**, карта `docs/HANDOFF_KV_REVIEW.md` использована только как ориентир (фолио/рёбра/спаны/seeds), не как истина.
**Скоуп:** 140 КВ-ядро `kv.mechanics.*` rule_cards (`book=kv_core`, все `verified:false`) на HEAD `4b616ac`. ИдО (49) и таблицы (33) — вне этой сессии (свой 2a уже закрыт, `GATE2A_IDO_FINDINGS.md`).
**Словарь вердиктов** (ADR-002 §2a): **SUPPORTED / PARTIAL / UNSUPPORTED** — следует ли `summary` (+`parameters`) из `source_text` без добавлений; верны ли `subsystem`/`section`; бьёт ли каждое `related`→ядро в **правильное** правило (+ аудит под-линкинга на пустых `related`).
**Базовые гейты ЗЕЛЁНЫЕ на этом HEAD:** `validate` 222 · `independent_check` 676/0 (текст-фиделити дословна — буквы руками не сверялись) · `check_determinism` byte-identical · `check_param_numbers` 0 дублей · gate-2b КВ закрыт (`content-packs/kv/gate2b_evidence/MANIFEST.md`, 0 расхождений 2026-06-23 — числа не перепрогонялись).
**Маршрутизация:** каждый PARTIAL/находка/нит — для будущей **авторской** сессии (правки только в `build_mechanics_b*.py`, ребилд byte-identical). Ревьюер не трогает `verified`, не правит JSON/скрипты. Косметика — **не блокирует** `verified:true`.

---

## Метод разрешения глифов БЕЗ скана (обоснование F1/F2)

`kv_core.txt` (gate-1 рез-источник) **и** текстовая копия КВ в knowledge — оба роняют пиктограммы Кости испытания (Око, руна Гэндальфа) и знак успеха ✶: в потоке остаётся голое слово «знак». Настоящий скан (`%PDF-1.7`, 242 стр.) у Ивана; gate-2b закрыт без необходимости его открывать. Две находки ниже (F1, F2) — это места, где автор закодировал референт «знака» **из глоссария по памяти**, а не по локальному смыслу. Референт устанавливается **без скана** по внутренней логике книги:

1. **Самоопределение книги.** В разделе про Кость испытания книга сама даёт: «Знак — наихудший результат… равен 0» = **Око**. То есть голый «знак» в механическом контексте — это Око, а не знак успеха.
2. **Греп-конвенция (5/5).** Все употребления оборота «выпадает/выпал знак» в книге = Око; контрпримеров ноль. «Знак успеха» всегда квалифицирован словом «успеха» («выпадает знак успеха» = и вовсе про значение 0 у Кости успеха).
3. **Result-independence.** «независимо от результата проверки» = эффект срабатывает вне зависимости от провала/успеха = поведение Ока, не знака успеха (последний — модификатор степени успеха).
4. **Канон TOR2e + заголовки раздела** (ВЗОР ОКА / ОКО МОРДОРА; «выпадение знака на Кости испытания считается провалом» в miserable).

Автор **умеет** различать глифы (доказано: `adversaries.format_opisaniya` кодирует инверсию feat-die врага Око→авто-успех / руна→0; `conditions.miserable` кодирует `eye_on_feat_die`; `reference.procedure_steps` читает «знак»=Око в miserable-автопровале). F1/F2 — **изолированные** осечки глоссарий-над-контекстом, не системная ошибка.

---

## Модель вердикта (две независимых оси)

- **Content** (ADR-002 §2a): SUPPORTED / PARTIAL / UNSUPPORTED — `summary`+`parameters` следуют из `source_text`, ничего не добавлено; рун-канон/знаки-эффекта где есть; `params_ref` разрешаются.
- **Edges**: OK / under-linked → [цель] / mis-targeted → [исправление]. (Гейты гарантируют отсутствие *висячих* рёбер; *корректность* и *полноту* проверяет этот ревью.)

Рёбер всего 337 — сплошная сверка нереальна; приоритет отдан хабам (§7), плотным кластерам и репрезентативному спот-чеку, как требует карта §3.3.

---

## Кластер ① — hero_creation — 38 карт (фолио 28–58)

Content **38/38 SUPPORTED**. Все три хаба проверены по рёбрам: `cultures`×12, `creating_heroes`×8, `callings`×6 — **все рёбра корректны**. Кросс-консистентность: extra distinctive-features и Тропы Тени каждого призвания (`calling_*`) совпадают с calling-only ключами `traits.spisok_otlichitelnyh_kachestv` и 6 Тропами `shadow.ispolzovanie_izyanov`. `combat_gear` — **единственный** владелец чисел оружия/брони (дублей нет, гарантия — зелёный `check_param_numbers`).

| хаб / ключевая карта | рёбра | вердикт |
|---|---|---|
| `creating_heroes` | n=8 | SUPPORTED — 8 шагов создания, все рёбра в ядро корректны |
| `cultures` | n=12 | SUPPORTED — 6 культур + производные, 12 рёбер корректны |
| `callings` | n=6 | SUPPORTED — 6 призваний, рёбра корректны |
| `combat_gear` | n=1 | SUPPORTED — sole-owner чисел снаряжения; единственный источник |
| `company` / `patron` / `fellowship_rating` | n=4/2/3 | SUPPORTED — рёбра в company/patron/important_companion корректны |

Остальные 33 карты кластера (`bardings`, `dwarves_*`, `men_of_bree`, `rangers_*`, `hobbits_*`, `elves_*`, `characteristics`, `derived_characteristics`, `distinctions`, `distinctive_features_intro`, `languages_and_names`, `skills_and_weapon_skills`, `starting_equipment`, `travelling_gear`, `useful_items`, `ponies_and_horses`, `safe_place`, `adventuring_path`, `experience`, `adventure_points`, `skill_points`, `further_adventures`, `previous_experience`, `starting_rewards_and_virtues`, и т.д.): **все SUPPORTED**, сводки — дословный пересказ вырезанного текста, рёбра одиночные и корректные. **§7-seed (гранулярность 38 карт) — рассужден ниже (J1): СОХРАНИТЬ split.**

## Кластер ② — checks — 19 карт (фолио 16–21)

Content **19/19 SUPPORTED**. `scene_structure` рун-канон **ВЕРЕН** (d12=11 Око, d12=12 руна Гэндальфа). `feat_die_values`/`success_die_values`/`degree_of_success`/`special_successes` — значения корректны.

| карта | content | edges |
|---|---|---|
| `who_rolls` | SUPPORTED | **[] → under-linked: + `checks.assistance`** (STRONG — карта операционно вводит правило Помощи) — **F3** |
| `which_ability` | SUPPORTED | **[] → under-linked: + `traits.navyki`, `traits.boevye_umeniya`, `valour_wisdom.doblest`, `valour_wisdom.mudrost`** (MODERATE — определяет способности 3 типов проверок) — **F3** |
| `retry` | SUPPORTED | **[] → опционально `checks.procedure`/`which_ability`** (WEAK — самодостаточное мета-правило; пусто **защитимо**) — **F3** |
| `assistance`, `bonus_dice_hope`, `bonus_penalty_stacking`, `degree_of_success`, `dice_set`, `favoured_*`, `feat_die_values`, `magical_success`, `penalty_dice`, `procedure`, `scene_structure`, `special_successes`, `success_die_values`, `target_numbers`, `when_required` | SUPPORTED | OK — рёбра корректны |

## Кластер ③ — eye — 3 карты (фолио 169–173)

Content **2/3 SUPPORTED · 1 PARTIAL**.

| карта | content | edges |
|---|---|---|
| `oko_mordora` | SUPPORTED | OK |
| `presledovanie` | SUPPORTED | OK |
| `bditelnost_oka` | **PARTIAL — F1** | OK (n=5, рёбра корректны) |

**F1** ниже (триггер роста ВЗОР ОКА закодирован неверным референтом).

## Кластер ④ — shadow — 5 карт (фолио 136–141)

Content **4/5 SUPPORTED · 1 PARTIAL**. Снят авторский ⚠GATE-2b флаг на `ispolzovanie_izyanov`: сетка Троп Тени (6 столбцов × 4 изъяна) сверена по-клеточно против линеаризованного `source_text` — все 6 столбцов читаются сверху-вниз корректно.

| карта | content | edges |
|---|---|---|
| `ten` | SUPPORTED | OK |
| `istochniki_teni` | SUPPORTED | OK |
| `bezumie` | SUPPORTED | OK |
| `ispolzovanie_izyanov` | SUPPORTED | OK (6 Троп верифицированы) |
| `bally_teni` | **PARTIAL — F2** | OK (n=6, рёбра корректны) |

## Кластер ⑤ — combat — 9 карт (фолио 93–105)

Content **9/9 SUPPORTED**. Хаб `sovershenie_atak`×7 — **все 7 рёбер корректны**. `raneniya`: Лёгкая=руна / Ужасная=Око — связка логически форсирована прозой (Око→умирание явно; число→дни; руна по исключению) + канон TOR. **§7-нит регистра** подтверждён: «фаза приключений» (строчная, большинство combat-карт) vs «Фаза приключений» (заглавная, `vyhod_iz_boya`) — косметика, **не блокирует** (J5).

| хаб / карта | рёбра | вердикт |
|---|---|---|
| `sovershenie_atak` | n=7 | SUPPORTED — все 7 рёбер корректны |
| `boevye_zadachi`, `posledovatelnost_boya`, `shagi_v_raunde_blizhnego_boya` | n=3 each | SUPPORTED — OK |
| `raneniya` | n=4 | SUPPORTED — Лёгкая=руна/Ужасная=Око логически форсирована; OK |
| `boy`, `nachalo_boya`, `oslozhneniya_i_preimuschestva`, `vyhod_iz_boya` | n=2/1/3/2 | SUPPORTED — OK (нит регистра section на `vyhod_iz_boya`) |

## Кластер ⑥ — journey — 6 карт (фолио 108–116)

Content **6/6 SUPPORTED**. 7 типов сцен совпадают; гексы/знаки-успеха корректны; цитаты Толкина — дословная вырезка (в сводки не затекли). `poryadok_puteshestviya`×5 — рёбра корректны.

| карта | content | edges |
|---|---|---|
| `puteshestvie`, `karta`, `puteshestvuyuschiy_otryad`, `poryadok_puteshestviya`, `razygryvanie_stsen_puteshestviya`, `opisanie_stsen_puteshestviya` | SUPPORTED | OK |

## Кластер ⑦ — council — 3 карты (фолио 104–108)

Content **3/3 SUPPORTED**. Кросс-чек ИдО-Q5 подтверждён: `zavershenie_soveta.parameters.resistance = {reasonable:3, bold:6, audacious:9}` присутствует как **PARAMETERS** (не только в прозе) — солист-владелец механики Совета корректен.

| карта | content | edges |
|---|---|---|
| `sovet`, `sotsialnoe_vzaimodeystvie`, `zavershenie_soveta` | SUPPORTED | OK (3/6/9 как parameters ✔) |

## Кластер ⑧ — fellowship_phase — 4 карты (фолио 118–123)

Content **4/4 SUPPORTED** · 1 OPEN-ITEM (F4). `nachinaniya_fazy_bratstva`×5 — рёбра корректны.

| карта | content | edges |
|---|---|---|
| `kak_ustroena_faza_bratstva`, `nachinaniya_fazy_bratstva`, `yol` | SUPPORTED | OK |
| `struktura_fazy_bratstva` | SUPPORTED | OK; **OPEN-ITEM F4** — `parameters.training_cost.status=pending_gate_2b` (лестница 4/8/12/20/26/30 переколочена слоем; привязка уровень↔цена не разрешена) |

## Кластер ⑨ — adversaries — 7 карт (фолио 142–157)

Content **7/7 SUPPORTED** (числа statblock-ов закрыты gate-2b). `format_opisaniya` корректно кодирует **инверсию feat-die врага** (Око→наивысший/авто-успех, руна Гэндальфа→0) И знаки-успеха — доказательство, что автор глифы различает (изолирует F1/F2).

| карта | content | edges |
|---|---|---|
| `format_opisaniya`, `protivniki`, `nedobrye_lyudi`, `volki`, `nezhit`, `orki`, `trolli` | SUPPORTED | OK (statblock-числа gate-2b-closed) |

**§7-seed (adversaries в `mechanics/`) — рассужден ниже (J4): СОХРАНИТЬ для Stage-0.**

## Кластер ⑩ — traits — 7 карт (фолио 60–69)

Content **7/7 SUPPORTED** (полные таксономии: 18 навыков с категорией+группой; 24+6 отличительных качеств; 4 боевых умения).

| карта | content | edges |
|---|---|---|
| `navyki`, `kategorii_navykov`, `spisok_navykov`, `boevye_umeniya`, `spisok_boevyh_umeniy`, `otlichitelnye_kachestva`, `spisok_otlichitelnyh_kachestv` | SUPPORTED | OK |

## Кластер ⑪ — treasure — 8 карт (фолио 158–168)

Content **8/8 SUPPORTED**; все 28 рёбер корректны; глифы Ока в КЛАД/НЕВЕЗЕНИЕ читаются верно. Сплит `volshebnye_nagrady` из `znamenitoe_oruzhie_bronya` оправдан (размер/референс).

| карта | content | edges |
|---|---|---|
| `sokrovishcha`, `spisok_sokrovishch`, `klady`, `sozdanie_dragocennosti`, `divnye_artefakty_chudesnye_predmety`, `znamenitoe_oruzhie_bronya`, `volshebnye_nagrady`, `proklyatye_predmety` | SUPPORTED | OK (28/28 рёбер) |

## Кластер ⑫ — rewards_virtues — 11 карт (фолио 78–90)

Content **11/11 SUPPORTED**. Хаб `kulturnye_osobennosti`×7 — рёбра корректны (по культуре в каждую `osobennosti_*`).

| карта | content | edges |
|---|---|---|
| `kulturnye_osobennosti` | n=7 | SUPPORTED — 7 рёбер корректны |
| `nagrady`, `spisok_nagrad`, `osobennosti`, `spisok_osobennostey`, `osobennosti_bardingov/elfov/gnomov/hobbitov/lyudey_bri/sledopytov_severa` | SUPPORTED | OK |

## Кластеры ⑬–⑲ — малые кластеры — 22 карты

Все **SUPPORTED**, рёбра корректны:

| кластер | карты | вердикт |
|---|---|---|
| **conditions** (4) | `overview`, `miserable`, `weariness`, `wounded` | 4/4 SUPPORTED. `miserable` кодирует `eye_on_feat_die` верно (эталон для F2). `overview` называет 3 состояния не дословно из своего спана — защитимо (это обзорная карта) |
| **endurance_hope** (3) | `vynoslivost`, `nadezhda`, `vynoslivost_i_nadezhda` | 3/3 SUPPORTED |
| **valour_wisdom** (2) | `doblest`, `mudrost` | 2/2 SUPPORTED |
| **keeper_tools** (2) | `kak_ustroena_faza_priklyucheniy`, `sessii_fazy_priklyucheniy` | 2/2 SUPPORTED |
| **equipment** (3) | `boevoe_snaryazhenie`, `oruzhie`, `bronya_i_schity` | 3/3 SUPPORTED — только описания; все числа отложены в `combat_gear` (single-source держится) |
| **reference** (3) | `character_sheet`, `game_terms`, `procedure_steps` | 3/3 SUPPORTED. `procedure_steps` читает голое «знак»=Око в miserable-автопровале верно (изолирует F1/F2) |
| **standard_of_living** (3) | `obraz_zhizni`, `opisaniya_obrazov_zhizni`, `nakoplenie_bogatstva` | 3/3 SUPPORTED |

---

## НАХОДКИ → авторская сессия (ревьюер НЕ правит)

### F1 — `eye.bditelnost_oka` = **PARTIAL** (содержательный дефект)
Триггер роста ВЗОР ОКА. Источник: «выпадает знак вне боя» (глиф уронён слоем). Автор закодировал:
- `parameters.growth.eyes_gaze.trigger = "выпадает знак вне боя (success-sign ✶ per book glossary; die unspecified — gate-2a)"`
- `notes`: лезет к «знак = знак успеха ✶ по глоссарию книги».

**Это неверный референт.** Правильный = **Око (Eye)**, установлен без скана (см. «Метод разрешения глифов»): (a) самоопределение книги «Знак… равен 0» = Око; (b) греп 5/5 «выпадает знак» = Око, 0 контрпримеров; (c) «независимо от результата проверки» = result-independent = поведение Ока; (d) заголовок ВЗОР ОКА/ОКО МОРДОРА + канон TOR2e.
**Рекоменд. автору:** `trigger` → Око (вне боя, +1; при напряжённой ситуации — два и более); очистить вводящую в заблуждение `notes`. Скан **не нужен**.

### F2 — `shadow.bally_teni` = **PARTIAL** (содержательный дефект)
`parameters.miserable_effect = "success_sign_on_feat_die_counts_as_failure"` — **неверно и самопротиворечиво** (знаки успеха на Кости испытания не появляются вовсе). Источник: «выпадение знака на Кости испытания считается провалом» = **Око**.
**Рекоменд. автору:** `miserable_effect` → `eye_on_feat_die` (как уже верно закодировано в `conditions.miserable`). Согласовать формулировку с эталонной картой.

### F3 — под-линкинг на 3 пустых `related` (кластер checks)
Гейты ловят только *висячие* рёбра, не *пропущенные* → явный аудит:
| карта | сила | рекоменд. `related`→ядро |
|---|---|---|
| `checks.who_rolls` | **STRONG** | + `checks.assistance` (операционно вводит правило Помощи) |
| `checks.which_ability` | **MODERATE** | + `traits.navyki`, `traits.boevye_umeniya`, `valour_wisdom.doblest`, `valour_wisdom.mudrost` |
| `checks.retry` | WEAK / защитимо | опц. `checks.procedure` / `checks.which_ability` — пусто допустимо (самодостаточное мета-правило) |

### F4 — `fellowship_phase.struktura_fazy_bratstva` = SUPPORTED, но OPEN-ITEM (числа)
`parameters.training_cost` несёт `status:pending_gate_2b` (лестница 4/8/12/20/26/30 — три колонки переколочены слоем; привязка уровень↔цена не разрешена). **Согласование с «gate-2b закрыт»:** скоуп gate-2b в карте §2 (навыки/statblock-и/культ-особенности/стартовое снаряжение/скаляры) **не упоминает** эту таблицу → она **действительно pending**, нужен скан фолио 119–120. `summary` благоразумно НЕ утверждает конкретных цен (faithful) → карта остаётся SUPPORTED; разрешение чисел — отдельная задача автору/Ивану со сканом, **не блокирует** содержательный стэмп.

---

## §7 JUDGMENT-SEEDS — рассуждения ревьюера

**J1 — гранулярность `hero_creation` (38 карт): СОХРАНИТЬ split.** Один-rule-one-card; каждая несёт дословный `source_text` + page-provenance (ядровый актив, ровно то, что защищает gate-1); хабы маршрутизируют корректно; дублей нет (зелёный `check_param_numbers`); согласуется с гранулярностью остального пака (combat/journey/treasure). Слияние теряет provenance и RAG-ценность без выгоды. **Отклонить слияние.**

**J2 — 3 пустых `related`:** проаудированы (F3). `who_rolls`/`which_ability` — под-линкинг (STRONG/MODERATE); `retry` — пусто защитимо (WEAK).

**J3 — хаб-рёбра:** `cultures`×12, `creating_heroes`×8, `sovershenie_atak`×7, `kulturnye_osobennosti`×7, `callings`×6, `bally_teni`×6 — **все проверены, рёбра корректны** (`bally_teni` — content-PARTIAL по F2, но её 6 рёбер в порядке).

**J4 — `adversaries` (7 карт) в `mechanics/` vs отдельный каталог: СОХРАНИТЬ для Stage-0.** `adversary.schema.json` существует → миграция в каталог — рефактор Stage-1, не выходной блокер Stage-0. Карты валидны, числа gate-2b-closed.

**J5 — нит регистра `section` в combat («фаза»/«Фаза приключений»): косметика, НЕ блокирует.** `vyhod_iz_boya` несёт заглавную «Фаза приключений», большинство combat-карт — строчную. Нормализация в build-скрипте, ребилд byte-identical. Не влияет на семантику/`verified`.

---

## GATE-2A BOTTOM LINE (140 КВ-ядро карт)

- **Content-фиделити: 138 / 140 SUPPORTED · 2 PARTIAL · 0 UNSUPPORTED.**
  - PARTIAL: `eye.bditelnost_oka` (F1), `shadow.bally_teni` (F2) — оба = один класс дефекта (референт «знака» закодирован из глоссария по памяти, правильный референт = **Око**, устанавливается без скана).
- **Edges:** все проверенные рёбра (хабы + плотные кластеры + спот-чек) **корректно нацелены**; **3 рекомендации под-линкинга** (F3: who_rolls STRONG, which_ability MODERATE, retry WEAK); **1 open-item чисел** (F4 training_cost, нужен скан фолио 119–120).
- **§7-seeds: 5/5 рассуждены** — J1 сохранить split · J2 → F3 · J3 хаб-рёбра корректны · J4 сохранить adversaries в mechanics · J5 нит регистра косметичен.
- Пак **равномерно высокофиделен**; `notes` хорошо документируют артефакты затёка слоя.

### Рекомендованный путь к стэмпу (координационный вызов, не действие ревьюера)
1. **Авторская сессия** применяет в `build_mechanics_b*.py`: F1 (trigger→Око + чистка notes), F2 (`miserable_effect`→`eye_on_feat_die`), F3 (who_rolls + assistance; which_ability + 4 ребра; retry — опц.), J5 (нормализация регистра section). Ребилд **остаётся byte-identical-к-себе** (детерминизм). F4 — отдельно со сканом (не блокирует).
2. **Быстрый gate-2a edge-re-confirm** (новые рёбра бьют в перечисленные цели — дёшево).
3. **gate-3 (lynn-review)** — отдельная фреш-сессия (ADR-001).
4. `mark_verified.py --dir content-packs/kv/mechanics …` без `--id-prefix` — стэмпует 140 КВ (49 ИдО idempotent-skip) → **выход Stage 0**.

*Альтернатива:* стэмп сейчас с F1/F2 как tracked-debt — **не рекомендуется**: оба PARTIAL — содержательные дефекты в parameters (движок Stage-1 читает `growth.eyes_gaze.trigger` и `miserable_effect`), и оба чинятся без скана. **Рекомендация ревьюера: применить F1/F2/F3 до стэмпа.**

---

*REVIEW-ONLY соблюдён: `verified` не тронут, JSON и build-скрипты не правились. Дерево @ `4b616ac`.*
