# HANDOFF — Stage-0 exit review: КВ core (140 cards) gate-2a map

> Авторский задел для **фреш gate-2a** сессии. Это КАРТА, не вердикт: судить по КНИГЕ (КВ-PDF / kv_core.txt), не по карте.

## 0. ADR-001 boundary (читать первым)

Этот проход ведёт **ревьюер ≠ автор экстракции**, в свежей сессии. Карта ниже — ориентир (фолио, рёбра, спаны), но все суждения SUPPORTED/PARTIAL/UNSUPPORTED выносятся по источнику (книга), не по формулировкам этого файла. Формат вердикта — как `docs/GATE2A_IDO_FINDINGS.md`.

## 1. Состояние

- **140 КВ-ядро карт** (`book=kv_core`), все `verified:false` — это вся оставшаяся масса Stage 0.

- 49 ИдО + 33 таблицы уже `verified:true` — не в скоупе.

- 5 авто-гейтов зелёные (`validate`/`independent_check`/`check_determinism`/`check_param_numbers`/`confirm_s1_edges`).

- Рёбер `related` (КВ→КВ, внутри ядра): **337** · карт с пустым `related`: **3** · `oracle_refs`/`params_ref`: **0/0** (solo-механика, в ядре отсутствует by design) · `source_text`: 129 карт×1 спан, 11 карт×2 спана.

## 2. ГАРАНТИРОВАНО гейтами — НЕ перепроверять

- **Текст-фиделити ячеек**: `independent_check.py` 676/0 — каждый `source_text` дословно режется из источника. Не сверять буквы руками.

- **Схема/структура**: `validate.py` 222/0. **Детерминизм**: byte-identical.

- **Висячих `related`** нет (validate ловит dangling). Но ГЕЙТЫ НЕ ЛОВЯТ *НЕВЕРНОЕ* или *НЕДОСТАЮЩЕЕ* ребро — это работа ревьюера (§3).

- **gate-2b КВ ЗАКРЫТ** (`content-packs/kv/gate2b_evidence/MANIFEST.md`, «0 расхождений, 2026-06-23»): все числа (навыки, статблоки 6 культур, культурные особенности, стартовое снаряжение, скаляры) сверены по сканам. **Числа не перепрогонять.**

## 3. НЕ покрыто гейтами — РАБОТА gate-2a

По каждой карте из §6, судя по книге:

1. **`summary` следует из `source_text` без добавлений** — никаких чисел/правил, которых нет в вырезанном тексте; пересказ, не интерпретация.

2. **`subsystem`/`section` верны** — карта стоит в той подсистеме и разделе книги, которые заявлены.

3. **Каждое `related` бьёт в *правильное* ядро-правило.** Их 337 — сплошная ручная сверка нереальна; приоритет: хабы (§7), кластеры с плотными рёбрами, спот-чек. Точные id целей — Приложение A.

4. **Под-линкинг-аудит** на 3 пустых `related`: `checks.retry`, `checks.which_ability`, `checks.who_rolls` — корректно ли пусты, или ребро пропущено.


*(`oracle_refs`-биндинги и `params_ref` — solo-особенность; в КВ-ядре их нет, проверять нечего. Числа уже закрыты gate-2b — см. §2/§5.)*

## 4. Механизм выхода Stage 0

Этот gate-2a → автор применяет 2a-правки (только в `build_mechanics_b*.py`) → регенерация → **gate-3 lynn-review** (последний, фреш) → Иван проставляет 140. Каждая сессия — своя, по ADR-001.

## 5. gate-2b КВ: статус ЗАКРЫТ — vision-worklist'а нет

В отличие от ИдО, у КВ поглазная сверка чисел **уже сделана** (`gate2b_evidence/MANIFEST.md`, воспроизводимые верификаторы `verify_gate2b_cultures.py` / `_cultural_features.py` / `_starting_gear.py`). Перепрогон НЕ нужен.

Если находка gate-3 потребует точечной ре-сверки скана — нужен **настоящий КВ-PDF** Ивана (`%PDF-1.7`, 242 стр.). **СМЕЩЕНИЕ: PDF-страница = книжный фолио + 1.** (Копия в knowledge проекта — голый текст без сканов; для вижн-сверки непригодна.)

## 6. Карта 140 КВ-карт (по кластерам)

Колонки: `name` · `folio` (книжный фолио; PDF=+1) · `section` (путь внутри главы) · `sp` (спанов) · `rel` (число рёбер) · `related→` (кластеры-цели) · `flag` (под ревьюера).


### hero_creation — «искатели приключений» (38 карт; рёбер 81; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `creating_heroes` | 28–29 | Ваши герои | 1 | 8 | hero_creation×8 |  |
| `characteristics` | 29 | КУЛЬТУРЫ ГЕРОЕВ → Характеристики | 1 | 3 | hero_creation×2, checks×1 |  |
| `cultures` | 29 | КУЛЬТУРЫ ГЕРОЕВ | 1 | 12 | hero_creation×12 |  |
| `distinctions` | 29 | КУЛЬТУРЫ ГЕРОЕВ → Отличия | 1 | 1 | hero_creation×1 |  |
| `derived_characteristics` | 29–30 | КУЛЬТУРЫ ГЕРОЕВ → Производные характеристики | 1 | 2 | hero_creation×2 |  |
| `distinctive_features_intro` | 30 | КУЛЬТУРЫ ГЕРОЕВ → Отличительные качества | 1 | 1 | hero_creation×1 |  |
| `skills_and_weapon_skills` | 30 | КУЛЬТУРЫ ГЕРОЕВ → Навыки и Боевые умения | 1 | 2 | checks×1, hero_creation×1 |  |
| `languages_and_names` | 30–32 | КУЛЬТУРЫ ГЕРОЕВ → Языки и типичные имена | 1 | 1 | hero_creation×1 |  |
| `bardings` | 32–34 | БАРДИНГИ | 1 | 1 | hero_creation×1 |  |
| `dwarves_of_durins_folk` | 34–36 | ГНОМЫ НАРОДА ДУРИНА | 1 | 1 | hero_creation×1 |  |
| `men_of_bree` | 36–38 | ЛЮДИ БРИ | 1 | 1 | hero_creation×1 |  |
| `rangers_of_the_north` | 38–40 | СЛЕДОПЫТЫ СЕВЕРА | 1 | 1 | hero_creation×1 |  |
| `hobbits_of_the_shire` | 40–42 | ХОББИТЫ ШИРА | 1 | 1 | hero_creation×1 |  |
| `elves_of_lindon` | 42–44 | ЭЛЬФЫ ЛИНДОНА | 1 | 1 | hero_creation×1 |  |
| `calling_messenger` | 44 | ПРИЗВАНИЯ → Вестник | 1 | 1 | hero_creation×1 |  |
| `callings` | 44 | ПРИЗВАНИЯ | 1 | 6 | hero_creation×6 |  |
| `calling_warrior` | 44–45 | ПРИЗВАНИЯ → Воитель | 1 | 1 | hero_creation×1 |  |
| `calling_captain` | 45 | ПРИЗВАНИЯ → Командир | 1 | 1 | hero_creation×1 |  |
| `calling_treasure_hunter` | 45 | ПРИЗВАНИЯ → Искатель сокровищ | 1 | 1 | hero_creation×1 |  |
| `calling_warden` | 45–46 | ПРИЗВАНИЯ → Страж | 1 | 1 | hero_creation×1 |  |
| `calling_scholar` | 46 | ПРИЗВАНИЯ → Учёный | 1 | 1 | hero_creation×1 |  |
| `previous_experience` | 46–47 | ПРЕДЫДУЩИЙ ОПЫТ | 1 | 2 | hero_creation×2 |  |
| `starting_equipment` | 47 | СТАРТОВОЕ СНАРЯЖЕНИЕ | 1 | 4 | hero_creation×4 |  |
| `combat_gear` | 47–49 | СТАРТОВОЕ СНАРЯЖЕНИЕ → Боевое снаряжение | 1 | 1 | hero_creation×1 |  |
| `travelling_gear` | 49 | СТАРТОВОЕ СНАРЯЖЕНИЕ → Походное снаряжение | 1 | 1 | hero_creation×1 |  |
| `useful_items` | 49–50 | СТАРТОВОЕ СНАРЯЖЕНИЕ → Полезные предметы | 1 | 2 | hero_creation×2 |  |
| `ponies_and_horses` | 50–51 | СТАРТОВОЕ СНАРЯЖЕНИЕ → Пони хоббитов и лошади | 2 | 2 | hero_creation×2 |  |
| `starting_rewards_and_virtues` | 51 | СТАРТОВЫЕ НАГРАДЫ И ОСОБЕННОСТИ | 2 | 1 | hero_creation×1 |  |
| `company` | 51–52 | ОТРЯД | 2 | 4 | hero_creation×4 |  |
| `patron` | 52–53 | ОТРЯД → Покровитель | 1 | 2 | hero_creation×2 |  |
| `safe_place` | 53–54 | ОТРЯД → Безопасное место | 1 | 1 | hero_creation×1 |  |
| `fellowship_rating` | 54–55 | ОТРЯД → Рейтинг братства | 1 | 3 | hero_creation×2, checks×1 |  |
| `important_companion` | 55 | ОТРЯД → Важный товарищ | 1 | 3 | hero_creation×2, checks×1 |  |
| `experience` | 55–56 | ОПЫТ | 1 | 2 | hero_creation×2 |  |
| `adventure_points` | 56 | ОПЫТ → Баллы приключений | 1 | 1 | hero_creation×1 |  |
| `further_adventures` | 56 | ДАЛЬНЕЙШИЕ ПРИКЛЮЧЕНИЯ | 1 | 1 | hero_creation×1 |  |
| `skill_points` | 56 | ОПЫТ → Баллы навыков | 1 | 1 | hero_creation×1 |  |
| `adventuring_path` | 56–58 | ДАЛЬНЕЙШИЕ ПРИКЛЮЧЕНИЯ → Путь приключений | 1 | 2 | hero_creation×2 |  |
| **∑ hero_creation** | | | 41 | 81 | | |

### standard_of_living — «отличия» (3 карт; рёбер 7; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `obraz_zhizni` | 72 | ОБРАЗ ЖИЗНИ | 1 | 3 | standard_of_living×2, hero_creation×1 |  |
| `opisaniya_obrazov_zhizni` | 72–73 | ОБРАЗ ЖИЗНИ → Описания Образов жизни | 1 | 2 | standard_of_living×2 |  |
| `nakoplenie_bogatstva` | 73 | ОБРАЗ ЖИЗНИ → Накопление богатства | 1 | 2 | standard_of_living×2 |  |
| **∑ standard_of_living** | | | 3 | 7 | | |

### traits — «отличия» (7 карт; рёбер 20; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `navyki` | 60 | НАВЫКИ | 1 | 4 | traits×2, checks×1, hero_creation×1 |  |
| `kategorii_navykov` | 60–61 | НАВЫКИ → Категории навыков | 1 | 3 | traits×2, checks×1 |  |
| `spisok_navykov` | 61–65 | НАВЫКИ → Список навыков | 1 | 3 | traits×2, hero_creation×1 |  |
| `boevye_umeniya` | 65 | БОЕВЫЕ УМЕНИЯ | 1 | 3 | checks×1, hero_creation×1, traits×1 |  |
| `spisok_boevyh_umeniy` | 65–67 | БОЕВЫЕ УМЕНИЯ → Список Боевых умений | 1 | 2 | hero_creation×1, traits×1 |  |
| `otlichitelnye_kachestva` | 67 | ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА | 1 | 2 | hero_creation×1, traits×1 |  |
| `spisok_otlichitelnyh_kachestv` | 67–69 | ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА → Список Отличительных качеств | 1 | 3 | hero_creation×2, traits×1 |  |
| **∑ traits** | | | 7 | 20 | | |

### valour_wisdom — «доблесть и мудрость» (2 карт; рёбер 5; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `doblest` | 78 | Доблесть | 1 | 3 | checks×1, hero_creation×1, valour_wisdom×1 |  |
| `mudrost` | 78 | Мудрость | 1 | 2 | hero_creation×1, valour_wisdom×1 |  |
| **∑ valour_wisdom** | | | 2 | 5 | | |

### rewards_virtues — «доблесть и мудрость» (11 карт; рёбер 27; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `nagrady` | 78–79 | НАГРАДЫ | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `spisok_nagrad` | 79–80 | НАГРАДЫ → Список Наград | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti` | 80 | ОСОБЕННОСТИ | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `spisok_osobennostey` | 80–81 | ОСОБЕННОСТИ → Список Особенностей | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `kulturnye_osobennosti` | 81 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ | 1 | 7 | rewards_virtues×7 |  |
| `osobennosti_bardingov` | 81–82 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности бардингов | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti_gnomov` | 82–84 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности гномов | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti_lyudey_bri` | 84–85 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности людей Бри | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti_sledopytov_severa` | 85–87 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности Следопытов Севера | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti_hobbitov` | 87–88 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности хоббитов | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| `osobennosti_elfov` | 88–90 | КУЛЬТУРНЫЕ ОСОБЕННОСТИ → Особенности эльфов | 1 | 2 | hero_creation×1, rewards_virtues×1 |  |
| **∑ rewards_virtues** | | | 11 | 27 | | |

### equipment — «отличия» (3 карт; рёбер 8; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `boevoe_snaryazhenie` | 73 | БОЕВОЕ СНАРЯЖЕНИЕ | 1 | 3 | equipment×2, hero_creation×1 |  |
| `oruzhie` | 73–75 | БОЕВОЕ СНАРЯЖЕНИЕ → Оружие | 1 | 3 | equipment×1, hero_creation×1, traits×1 |  |
| `bronya_i_schity` | 75–76 | БОЕВОЕ СНАРЯЖЕНИЕ → Броня и щиты | 1 | 2 | equipment×1, hero_creation×1 |  |
| **∑ equipment** | | | 3 | 8 | | |

### checks — «Выполнение действий» (19 карт; рёбер 23; пустых 3)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `dice_set` | 16 | Игральные кости | 1 | 2 | checks×2 |  |
| `when_required` | 16 | Выполнение проверок → Когда требуется проверка | 1 | 1 | checks×1 |  |
| `scene_structure` | 16–17 | Краткое описание сцен | 1 | 2 | checks×2 |  |
| `feat_die_values` | 17 | Выполнение проверок → Значение Костей испытания | 1 | 1 | checks×1 |  |
| `procedure` | 17 | Выполнение проверок → Ход проверки | 1 | 2 | checks×2 |  |
| `retry` | 17 | Выполнение проверок → Повторная проверка | 1 | 0 | — |  |
| `which_ability` | 17 | Выполнение проверок → Какая способность проверяется | 1 | 0 | — |  |
| `who_rolls` | 17 | Выполнение проверок → Кто выполняет проверку | 1 | 0 | — |  |
| `degree_of_success` | 18 | Выполнение проверок → Степень успеха | 1 | 1 | checks×1 |  |
| `success_die_values` | 18 | Выполнение проверок → Значение Костей успеха | 1 | 1 | checks×1 |  |
| `target_numbers` | 18 | Выполнение проверок → Целевые числа | 2 | 1 | checks×1 |  |
| `special_successes` | 18–19 | Выполнение проверок → Степень успеха → Особые успехи | 2 | 1 | checks×1 |  |
| `bonus_dice_hope` | 20 | Модификаторы броска → Бонус к Костям успеха | 1 | 2 | checks×2 |  |
| `favoured_ill_favoured` | 20 | Модификаторы броска | 2 | 1 | checks×1 |  |
| `assistance` | 20–21 | Модификаторы броска → Помощь | 2 | 1 | checks×1 |  |
| `favoured_edge_cases` | 20–21 | Модификаторы броска → Благополучный и злополучный бросок | 2 | 2 | checks×1, conditions×1 |  |
| `bonus_penalty_stacking` | 21 | Модификаторы броска → Бонусы и штрафы | 1 | 2 | checks×2 |  |
| `magical_success` | 21 | Модификаторы броска → Волшебный успех | 2 | 2 | checks×2 |  |
| `penalty_dice` | 21 | Модификаторы броска → Штраф к Костям успеха | 1 | 1 | checks×1 |  |
| **∑ checks** | | | 25 | 23 | | |

### combat — «фаза приключений» (9 карт; рёбер 28; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `raneniya` | 101 | БОЙ → Ранения | 1 | 4 | combat×1, conditions×1, endurance_hope×1, traits×1 |  |
| `oslozhneniya_i_preimuschestva` | 101–102 | БОЙ → Осложнения и преимущества | 1 | 3 | combat×2, traits×1 |  |
| `boevye_zadachi` | 102–104 | БОЙ → Боевые задачи | 1 | 3 | combat×2, traits×1 |  |
| `vyhod_iz_boya` | 105 | Фаза приключений → БОЙ → Выход из боя | 1 | 2 | combat×2 |  |
| `boy` | 93 | БОЙ | 1 | 2 | combat×2 |  |
| `nachalo_boya` | 93–94 | БОЙ → Начало боя | 1 | 1 | combat×1 |  |
| `posledovatelnost_boya` | 94–95 | БОЙ → Последовательность боя | 1 | 3 | combat×2, traits×1 |  |
| `shagi_v_raunde_blizhnego_boya` | 95–98 | БОЙ → Шаги в раунде ближнего боя | 1 | 3 | combat×3 |  |
| `sovershenie_atak` | 98–101 | БОЙ → Совершение атак | 1 | 7 | combat×3, endurance_hope×1, hero_creation×1, standard_of_living×1, traits×1 |  |
| **∑ combat** | | | 9 | 28 | | |

### journey — «Фаза приключений» (6 карт; рёбер 16; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `puteshestvie` | 108 | ПУТЕШЕСТВИЕ | 1 | 2 | journey×2 |  |
| `karta` | 108–109 | ПУТЕШЕСТВИЕ → Карта | 1 | 2 | journey×2 |  |
| `puteshestvuyuschiy_otryad` | 109 | ПУТЕШЕСТВИЕ → Путешествующий отряд | 1 | 2 | journey×2 |  |
| `poryadok_puteshestviya` | 109–112 | ПУТЕШЕСТВИЕ → Порядок путешествия | 1 | 5 | journey×2, endurance_hope×1, hero_creation×1, traits×1 |  |
| `razygryvanie_stsen_puteshestviya` | 112–114 | ПУТЕШЕСТВИЕ → Разыгрывание сцен путешествия | 1 | 4 | journey×2, checks×1, traits×1 |  |
| `opisanie_stsen_puteshestviya` | 114–116 | ПУТЕШЕСТВИЕ → Описание сцен путешествия | 1 | 1 | journey×1 |  |
| **∑ journey** | | | 6 | 16 | | |

### council — «Фаза приключений» (3 карт; рёбер 7; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `sovet` | 104 | СОВЕТ | 1 | 2 | council×2 |  |
| `sotsialnoe_vzaimodeystvie` | 104–108 | СОВЕТ → Социальное взаимодействие | 1 | 2 | council×2 |  |
| `zavershenie_soveta` | 105–108 | СОВЕТ → Определение сопротивления / Знакомство / Переговоры / Завершение | 1 | 3 | council×2, traits×1 |  |
| **∑ council** | | | 3 | 7 | | |

### fellowship_phase — «ФАЗА БРАТСТВА» (4 карт; рёбер 13; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `kak_ustroena_faza_bratstva` | 118 | Как устроена Фаза братства | 1 | 1 | fellowship_phase×1 |  |
| `struktura_fazy_bratstva` | 118–120 | Структура Фазы братства | 1 | 5 | fellowship_phase×2, valour_wisdom×2, endurance_hope×1 |  |
| `yol` | 120–121 | Йоль | 1 | 2 | fellowship_phase×2 |  |
| `nachinaniya_fazy_bratstva` | 121–123 | Начинания Фазы братства | 1 | 5 | hero_creation×2, fellowship_phase×1, standard_of_living×1, traits×1 |  |
| **∑ fellowship_phase** | | | 4 | 13 | | |

### endurance_hope — «отличия» (3 карт; рёбер 10; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `vynoslivost_i_nadezhda` | 69 | ВЫНОСЛИВОСТЬ И НАДЕЖДА | 1 | 3 | endurance_hope×2, hero_creation×1 |  |
| `vynoslivost` | 69–71 | ВЫНОСЛИВОСТЬ И НАДЕЖДА → Выносливость | 1 | 3 | conditions×1, endurance_hope×1, hero_creation×1 |  |
| `nadezhda` | 71–72 | ВЫНОСЛИВОСТЬ И НАДЕЖДА → Надежда | 1 | 4 | checks×1, conditions×1, endurance_hope×1, hero_creation×1 |  |
| **∑ endurance_hope** | | | 3 | 10 | | |

### shadow — «Хранитель» (5 карт; рёбер 18; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `ten` | 136–137 | ТЕНЬ | 1 | 2 | shadow×2 |  |
| `bally_teni` | 137–138 | ТЕНЬ → Баллы Тени | 1 | 6 | shadow×2, valour_wisdom×2, endurance_hope×1, fellowship_phase×1 |  |
| `istochniki_teni` | 137–139 | ТЕНЬ → Источники тени | 1 | 4 | shadow×2, valour_wisdom×2 |  |
| `bezumie` | 139–140 | ТЕНЬ → Безумие | 1 | 3 | shadow×2, hero_creation×1 |  |
| `ispolzovanie_izyanov` | 140–141 | ТЕНЬ → Пути Тени / Использование Изъянов | 1 | 3 | hero_creation×1, shadow×1, traits×1 |  |
| **∑ shadow** | | | 5 | 18 | | |

### eye — «Око Мордора» (3 карт; рёбер 11; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `oko_mordora` | 169 | ОКО МОРДОРА | 1 | 2 | eye×2 |  |
| `bditelnost_oka` | 169–172 | Бдительность Ока | 1 | 5 | eye×2, checks×1, shadow×1, valour_wisdom×1 |  |
| `presledovanie` | 172–173 | Преследование | 1 | 4 | council×1, endurance_hope×1, eye×1, shadow×1 |  |
| **∑ eye** | | | 3 | 11 | | |

### conditions — «Выполнение действий» (4 карт; рёбер 7; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `miserable` | 22 | Состояния → Несчастье | 1 | 2 | checks×1, conditions×1 |  |
| `overview` | 22 | Состояния | 1 | 3 | conditions×3 |  |
| `weariness` | 22 | Состояния → Усталость | 1 | 1 | conditions×1 |  |
| `wounded` | 22 | Состояния → Ранение | 1 | 1 | conditions×1 |  |
| **∑ conditions** | | | 4 | 7 | | |

### treasure — «Сокровища» (8 карт; рёбер 28; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `sokrovishcha` | 158 | (вступление) | 1 | 2 | treasure×2 |  |
| `klady` | 158–159 | КЛАДЫ | 2 | 5 | treasure×2, checks×1, endurance_hope×1, shadow×1 |  |
| `sozdanie_dragocennosti` | 159–160 | Создание драгоценности | 2 | 3 | treasure×2, fellowship_phase×1 |  |
| `spisok_sokrovishch` | 160–161 | Список сокровищ | 1 | 2 | treasure×2 |  |
| `divnye_artefakty_chudesnye_predmety` | 161–162 | Дивные артефакты и Чудесные предметы | 1 | 3 | treasure×2, fellowship_phase×1 |  |
| `znamenitoe_oruzhie_bronya` | 162–164 | Знаменитое оружие и броня | 1 | 4 | treasure×2, fellowship_phase×1, valour_wisdom×1 |  |
| `volshebnye_nagrady` | 165–167 | Знаменитое оружие и броня → ВОЛШЕБНЫЕ НАГРАДЫ | 1 | 4 | checks×1, endurance_hope×1, treasure×1, valour_wisdom×1 |  |
| `proklyatye_predmety` | 167–168 | Проклятые предметы | 1 | 5 | treasure×2, checks×1, council×1, shadow×1 |  |
| **∑ treasure** | | | 10 | 28 | | |

### adversaries — «Противники» (7 карт; рёбер 18; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `protivniki` | 142 | (вступление) | 1 | 1 | adversaries×1 |  |
| `format_opisaniya` | 143–144 | формат описания врагов | 1 | 4 | adversaries×1, checks×1, endurance_hope×1, shadow×1 |  |
| `volki` | 146–147 | ВОЛКИ ДИКИХ ЗЕМЕЛЬ | 1 | 3 | adversaries×1, checks×1, shadow×1 |  |
| `nedobrye_lyudi` | 148–149 | НЕДОБРЫЕ ЛЮДИ | 1 | 2 | adversaries×1, checks×1 |  |
| `nezhit` | 150–151 | НЕЖИТЬ | 1 | 3 | adversaries×1, checks×1, shadow×1 |  |
| `orki` | 152–154 | ОРКИ | 1 | 2 | adversaries×1, checks×1 |  |
| `trolli` | 155–157 | ТРОЛЛИ | 1 | 3 | adversaries×1, checks×1, shadow×1 |  |
| **∑ adversaries** | | | 7 | 18 | | |

### keeper_tools — «Фаза приключений» (2 карт; рёбер 4; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `kak_ustroena_faza_priklyucheniy` | 92 | Как устроена Фаза приключений | 1 | 2 | fellowship_phase×1, keeper_tools×1 |  |
| `sessii_fazy_priklyucheniy` | 92–93 | Сессии Фазы приключений | 1 | 2 | council×1, keeper_tools×1 |  |
| **∑ keeper_tools** | | | 2 | 4 | | |

### reference — «Выполнение действий» (3 карт; рёбер 6; пустых 0)

| name | folio | section | sp | rel | related→ | flag |
|---|---|---|---|---|---|---|
| `character_sheet` | 22–23 | Бланк героя | 1 | 1 | reference×1 |  |
| `procedure_steps` | 23–24 | Выполнение проверок → Порядок совершения проверки | 1 | 3 | checks×3 |  |
| `game_terms` | 24–26 | Игровые термины | 1 | 2 | checks×1, conditions×1 |  |
| **∑ reference** | | | 3 | 6 | | |

## 7. Открытые judgment-call'ы (спот-чек ревьюера, НЕ истина)

1. **Гранулярность `hero_creation` (38 карт)** — крупнейший кластер. Оправдан ли сплит (отдельные карты на призвания/культуры/опыт), нет ли пере-дробления или дублей.

2. **3 пустых `related`**: `checks.retry`, `checks.which_ability`, `checks.who_rolls` — под-линкинг-аудит (эти карты действительно ничего не модифицируют?).

3. **Рёбра-хабы**: `hero_creation.cultures`×12, `hero_creation.creating_heroes`×8, `combat.sovershenie_atak`×7, `rewards_virtues.kulturnye_osobennosti`×7, `hero_creation.callings`×6, `shadow.bally_teni`×6 — наиболее вероятные носители неверного/недостающего ребра.

4. **`adversaries` живёт 7 картами в `mechanics/`**, не в отдельном `adversaries/` (arch §3.2). Оставить/вынести — мелкий структурный вопрос, не блокер.

5. **Нит регистра `section`** (находка разведки): `combat`: ['фаза приключений', 'Фаза приключений']. Один корень секции записан в разном регистре — ликвидно в build-скрипте, не контент-ошибка; решить, нужна ли нормализация.


## Приложение A — полные `related` id по картам

Для точного аудита §3.3: цели рёбер (id без префикса `kv.mechanics.`). Пустые опущены.


**hero_creation**

- `adventure_points` → hero_creation.experience
- `adventuring_path` → hero_creation.further_adventures, hero_creation.previous_experience
- `bardings` → hero_creation.cultures
- `calling_captain` → hero_creation.callings
- `calling_messenger` → hero_creation.callings
- `calling_scholar` → hero_creation.callings
- `calling_treasure_hunter` → hero_creation.callings
- `calling_warden` → hero_creation.callings
- `calling_warrior` → hero_creation.callings
- `callings` → hero_creation.calling_captain, hero_creation.calling_messenger, hero_creation.calling_scholar, hero_creation.calling_treasure_hunter, hero_creation.calling_warden, hero_creation.calling_warrior
- `characteristics` → checks.target_numbers, hero_creation.cultures, hero_creation.derived_characteristics
- `combat_gear` → hero_creation.starting_equipment
- `company` → hero_creation.fellowship_rating, hero_creation.important_companion, hero_creation.patron, hero_creation.safe_place
- `creating_heroes` → hero_creation.callings, hero_creation.company, hero_creation.cultures, hero_creation.experience, hero_creation.further_adventures, hero_creation.previous_experience, hero_creation.starting_equipment, hero_creation.starting_rewards_and_virtues
- `cultures` → hero_creation.bardings, hero_creation.characteristics, hero_creation.derived_characteristics, hero_creation.distinctions, hero_creation.distinctive_features_intro, hero_creation.dwarves_of_durins_folk, hero_creation.elves_of_lindon, hero_creation.hobbits_of_the_shire, hero_creation.languages_and_names, hero_creation.men_of_bree, hero_creation.rangers_of_the_north, hero_creation.skills_and_weapon_skills
- `derived_characteristics` → hero_creation.characteristics, hero_creation.cultures
- `distinctions` → hero_creation.cultures
- `distinctive_features_intro` → hero_creation.cultures
- `dwarves_of_durins_folk` → hero_creation.cultures
- `elves_of_lindon` → hero_creation.cultures
- `experience` → hero_creation.adventure_points, hero_creation.skill_points
- `fellowship_rating` → checks.bonus_dice_hope, hero_creation.company, hero_creation.patron
- `further_adventures` → hero_creation.adventuring_path
- `hobbits_of_the_shire` → hero_creation.cultures
- `important_companion` → checks.assistance, hero_creation.company, hero_creation.fellowship_rating
- `languages_and_names` → hero_creation.cultures
- `men_of_bree` → hero_creation.cultures
- `patron` → hero_creation.company, hero_creation.fellowship_rating
- `ponies_and_horses` → hero_creation.starting_equipment, hero_creation.useful_items
- `previous_experience` → hero_creation.adventuring_path, hero_creation.creating_heroes
- `rangers_of_the_north` → hero_creation.cultures
- `safe_place` → hero_creation.company
- `skill_points` → hero_creation.experience
- `skills_and_weapon_skills` → checks.which_ability, hero_creation.cultures
- `starting_equipment` → hero_creation.combat_gear, hero_creation.ponies_and_horses, hero_creation.travelling_gear, hero_creation.useful_items
- `starting_rewards_and_virtues` → hero_creation.creating_heroes
- `travelling_gear` → hero_creation.starting_equipment
- `useful_items` → hero_creation.ponies_and_horses, hero_creation.starting_equipment

**standard_of_living**

- `nakoplenie_bogatstva` → standard_of_living.obraz_zhizni, standard_of_living.opisaniya_obrazov_zhizni
- `obraz_zhizni` → hero_creation.starting_equipment, standard_of_living.nakoplenie_bogatstva, standard_of_living.opisaniya_obrazov_zhizni
- `opisaniya_obrazov_zhizni` → standard_of_living.nakoplenie_bogatstva, standard_of_living.obraz_zhizni

**traits**

- `boevye_umeniya` → checks.target_numbers, hero_creation.skills_and_weapon_skills, traits.spisok_boevyh_umeniy
- `kategorii_navykov` → checks.target_numbers, traits.navyki, traits.spisok_navykov
- `navyki` → checks.which_ability, hero_creation.skills_and_weapon_skills, traits.kategorii_navykov, traits.spisok_navykov
- `otlichitelnye_kachestva` → hero_creation.distinctive_features_intro, traits.spisok_otlichitelnyh_kachestv
- `spisok_boevyh_umeniy` → hero_creation.combat_gear, traits.boevye_umeniya
- `spisok_navykov` → hero_creation.skills_and_weapon_skills, traits.kategorii_navykov, traits.navyki
- `spisok_otlichitelnyh_kachestv` → hero_creation.callings, hero_creation.distinctive_features_intro, traits.otlichitelnye_kachestva

**valour_wisdom**

- `doblest` → checks.target_numbers, hero_creation.starting_rewards_and_virtues, valour_wisdom.mudrost
- `mudrost` → hero_creation.starting_rewards_and_virtues, valour_wisdom.doblest

**rewards_virtues**

- `kulturnye_osobennosti` → rewards_virtues.osobennosti, rewards_virtues.osobennosti_bardingov, rewards_virtues.osobennosti_elfov, rewards_virtues.osobennosti_gnomov, rewards_virtues.osobennosti_hobbitov, rewards_virtues.osobennosti_lyudey_bri, rewards_virtues.osobennosti_sledopytov_severa
- `nagrady` → hero_creation.starting_rewards_and_virtues, rewards_virtues.spisok_nagrad
- `osobennosti` → hero_creation.starting_rewards_and_virtues, rewards_virtues.spisok_osobennostey
- `osobennosti_bardingov` → hero_creation.bardings, rewards_virtues.kulturnye_osobennosti
- `osobennosti_elfov` → hero_creation.elves_of_lindon, rewards_virtues.kulturnye_osobennosti
- `osobennosti_gnomov` → hero_creation.dwarves_of_durins_folk, rewards_virtues.kulturnye_osobennosti
- `osobennosti_hobbitov` → hero_creation.hobbits_of_the_shire, rewards_virtues.kulturnye_osobennosti
- `osobennosti_lyudey_bri` → hero_creation.men_of_bree, rewards_virtues.kulturnye_osobennosti
- `osobennosti_sledopytov_severa` → hero_creation.rangers_of_the_north, rewards_virtues.kulturnye_osobennosti
- `spisok_nagrad` → hero_creation.combat_gear, rewards_virtues.nagrady
- `spisok_osobennostey` → hero_creation.starting_rewards_and_virtues, rewards_virtues.osobennosti

**equipment**

- `boevoe_snaryazhenie` → equipment.bronya_i_schity, equipment.oruzhie, hero_creation.combat_gear
- `bronya_i_schity` → equipment.boevoe_snaryazhenie, hero_creation.combat_gear
- `oruzhie` → equipment.boevoe_snaryazhenie, hero_creation.combat_gear, traits.spisok_boevyh_umeniy

**checks**

- `assistance` → checks.bonus_dice_hope
- `bonus_dice_hope` → checks.assistance, checks.penalty_dice
- `bonus_penalty_stacking` → checks.bonus_dice_hope, checks.penalty_dice
- `degree_of_success` → checks.special_successes
- `dice_set` → checks.feat_die_values, checks.success_die_values
- `favoured_edge_cases` → checks.favoured_ill_favoured, conditions.miserable
- `favoured_ill_favoured` → checks.feat_die_values
- `feat_die_values` → checks.success_die_values
- `magical_success` → checks.bonus_dice_hope, checks.degree_of_success
- `penalty_dice` → checks.bonus_penalty_stacking
- `procedure` → checks.degree_of_success, checks.target_numbers
- `scene_structure` → checks.dice_set, checks.feat_die_values
- `special_successes` → checks.degree_of_success
- `success_die_values` → checks.degree_of_success
- `target_numbers` → checks.procedure
- `when_required` → checks.procedure

**combat**

- `boevye_zadachi` → combat.shagi_v_raunde_blizhnego_boya, combat.sovershenie_atak, traits.spisok_navykov
- `boy` → combat.nachalo_boya, combat.posledovatelnost_boya
- `nachalo_boya` → combat.posledovatelnost_boya
- `oslozhneniya_i_preimuschestva` → combat.boevye_zadachi, combat.sovershenie_atak, traits.spisok_navykov
- `posledovatelnost_boya` → combat.shagi_v_raunde_blizhnego_boya, combat.sovershenie_atak, traits.spisok_navykov
- `raneniya` → combat.sovershenie_atak, conditions.wounded, endurance_hope.vynoslivost, traits.spisok_navykov
- `shagi_v_raunde_blizhnego_boya` → combat.boevye_zadachi, combat.posledovatelnost_boya, combat.sovershenie_atak
- `sovershenie_atak` → combat.boevye_zadachi, combat.raneniya, combat.shagi_v_raunde_blizhnego_boya, endurance_hope.vynoslivost, hero_creation.combat_gear, standard_of_living.obraz_zhizni, traits.spisok_boevyh_umeniy
- `vyhod_iz_boya` → combat.shagi_v_raunde_blizhnego_boya, combat.sovershenie_atak

**journey**

- `karta` → journey.poryadok_puteshestviya, journey.puteshestvie
- `opisanie_stsen_puteshestviya` → journey.razygryvanie_stsen_puteshestviya
- `poryadok_puteshestviya` → endurance_hope.vynoslivost, hero_creation.ponies_and_horses, journey.puteshestvuyuschiy_otryad, journey.razygryvanie_stsen_puteshestviya, traits.spisok_navykov
- `puteshestvie` → journey.karta, journey.poryadok_puteshestviya
- `puteshestvuyuschiy_otryad` → journey.poryadok_puteshestviya, journey.razygryvanie_stsen_puteshestviya
- `razygryvanie_stsen_puteshestviya` → checks.feat_die_values, journey.opisanie_stsen_puteshestviya, journey.poryadok_puteshestviya, traits.spisok_navykov

**council**

- `sotsialnoe_vzaimodeystvie` → council.sovet, council.zavershenie_soveta
- `sovet` → council.sotsialnoe_vzaimodeystvie, council.zavershenie_soveta
- `zavershenie_soveta` → council.sotsialnoe_vzaimodeystvie, council.sovet, traits.spisok_navykov

**fellowship_phase**

- `kak_ustroena_faza_bratstva` → fellowship_phase.struktura_fazy_bratstva
- `nachinaniya_fazy_bratstva` → fellowship_phase.struktura_fazy_bratstva, hero_creation.callings, hero_creation.patron, standard_of_living.obraz_zhizni, traits.otlichitelnye_kachestva
- `struktura_fazy_bratstva` → endurance_hope.nadezhda, fellowship_phase.nachinaniya_fazy_bratstva, fellowship_phase.yol, valour_wisdom.doblest, valour_wisdom.mudrost
- `yol` → fellowship_phase.nachinaniya_fazy_bratstva, fellowship_phase.struktura_fazy_bratstva

**endurance_hope**

- `nadezhda` → checks.bonus_dice_hope, conditions.miserable, endurance_hope.vynoslivost_i_nadezhda, hero_creation.fellowship_rating
- `vynoslivost` → conditions.weariness, endurance_hope.vynoslivost_i_nadezhda, hero_creation.ponies_and_horses
- `vynoslivost_i_nadezhda` → endurance_hope.nadezhda, endurance_hope.vynoslivost, hero_creation.derived_characteristics

**shadow**

- `bally_teni` → endurance_hope.nadezhda, fellowship_phase.nachinaniya_fazy_bratstva, shadow.bezumie, shadow.istochniki_teni, valour_wisdom.doblest, valour_wisdom.mudrost
- `bezumie` → hero_creation.callings, shadow.bally_teni, shadow.ispolzovanie_izyanov
- `ispolzovanie_izyanov` → hero_creation.callings, shadow.bezumie, traits.otlichitelnye_kachestva
- `istochniki_teni` → shadow.bally_teni, shadow.bezumie, valour_wisdom.doblest, valour_wisdom.mudrost
- `ten` → shadow.bally_teni, shadow.istochniki_teni

**eye**

- `bditelnost_oka` → checks.feat_die_values, eye.oko_mordora, eye.presledovanie, shadow.bally_teni, valour_wisdom.doblest
- `oko_mordora` → eye.bditelnost_oka, eye.presledovanie
- `presledovanie` → council.zavershenie_soveta, endurance_hope.vynoslivost, eye.bditelnost_oka, shadow.bally_teni

**conditions**

- `miserable` → checks.feat_die_values, conditions.overview
- `overview` → conditions.miserable, conditions.weariness, conditions.wounded
- `weariness` → conditions.overview
- `wounded` → conditions.overview

**treasure**

- `divnye_artefakty_chudesnye_predmety` → fellowship_phase.nachinaniya_fazy_bratstva, treasure.spisok_sokrovishch, treasure.znamenitoe_oruzhie_bronya
- `klady` → checks.feat_die_values, endurance_hope.vynoslivost, shadow.istochniki_teni, treasure.sokrovishcha, treasure.sozdanie_dragocennosti
- `proklyatye_predmety` → checks.feat_die_values, council.zavershenie_soveta, shadow.ispolzovanie_izyanov, treasure.sozdanie_dragocennosti, treasure.znamenitoe_oruzhie_bronya
- `sokrovishcha` → treasure.klady, treasure.sozdanie_dragocennosti
- `sozdanie_dragocennosti` → fellowship_phase.nachinaniya_fazy_bratstva, treasure.klady, treasure.spisok_sokrovishch
- `spisok_sokrovishch` → treasure.klady, treasure.sozdanie_dragocennosti
- `volshebnye_nagrady` → checks.feat_die_values, endurance_hope.vynoslivost, treasure.znamenitoe_oruzhie_bronya, valour_wisdom.doblest
- `znamenitoe_oruzhie_bronya` → fellowship_phase.nachinaniya_fazy_bratstva, treasure.spisok_sokrovishch, treasure.volshebnye_nagrady, valour_wisdom.doblest

**adversaries**

- `format_opisaniya` → adversaries.protivniki, checks.feat_die_values, endurance_hope.vynoslivost, shadow.istochniki_teni
- `nedobrye_lyudi` → adversaries.format_opisaniya, checks.feat_die_values
- `nezhit` → adversaries.format_opisaniya, checks.feat_die_values, shadow.istochniki_teni
- `orki` → adversaries.format_opisaniya, checks.feat_die_values
- `protivniki` → adversaries.format_opisaniya
- `trolli` → adversaries.format_opisaniya, checks.feat_die_values, shadow.istochniki_teni
- `volki` → adversaries.format_opisaniya, checks.feat_die_values, shadow.istochniki_teni

**keeper_tools**

- `kak_ustroena_faza_priklyucheniy` → fellowship_phase.kak_ustroena_faza_bratstva, keeper_tools.sessii_fazy_priklyucheniy
- `sessii_fazy_priklyucheniy` → council.sovet, keeper_tools.kak_ustroena_faza_priklyucheniy

**reference**

- `character_sheet` → reference.game_terms
- `game_terms` → checks.target_numbers, conditions.overview
- `procedure_steps` → checks.degree_of_success, checks.procedure, checks.target_numbers

## 8. Источники и тулинг (КВ-специфика)

- **Источник истины рёбер/спанов/сводок** — `build_mechanics_b21.py … b9.py` (+ `build_mechanics_pilot.py`); JSON выводится, ребилд byte-identical. Правки — только в скрипты.

- **gate-1 рез-источник КВ** — `tools/extraction/source_kv/kv_core.txt` (деградированный текст-огрызок; перерезать с настоящего PDF ОТКЛОНЕНО — другая линеаризация ломает gate-1 на ~60% ячеек).

- **gate-2b vision-источник** — настоящий КВ-PDF Ивана (offset PDF=фолио+1); растр: `pdftoppm -jpeg -r 135 -f <PDF#> -l <PDF#> <pdf> out`. Гейт уже закрыт (§5).

- **Гейты**: `validate.py`, `independent_check.py`, `check_determinism.py`, `check_param_numbers.py`, `confirm_s1_edges.py`. **Verify-only**: `mark_verified.py`.

- **Прецеденты (как карта, НЕ истина)**: `docs/HANDOFF_IDO_REVIEW.md`, `docs/GATE2A_IDO_FINDINGS.md`, `docs/HANDOFF_IDO_GATE3_LYNN.md`, `ADR-001`, `ADR-002`.


---
**ИТОГИ: 140 карт · 19 кластеров · 337 related→ядро · 3 пустых-related · 0 oracle/params (by design).**


*Сгенерировано `tools/extraction/build_kv_review_map.py` из 140 JSON — числа не могут разойтись с картами; регенерируется при их изменении.*

