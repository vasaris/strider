# HANDOFF: сессия 3a (ядро правил КВ), полный прогон — состояние и продолжение

## Где мы
Этап 0, сессия 3a. Рубрикатор КВ (стр. 14–123) нарезан в 110 скелетов; идёт
курирование батчами: скелет → summary + parameters + related → перенос в
content-packs/kv/mechanics/ → в конце гейты ADR-002 и mark_verified.

СДЕЛАНО:
- B1 нарезка: segment_3a.py → 110 скелетов в tools/extraction/staging_3a/.
- B2.1 скурирован: checks (19) + conditions (4) + reference (3) = 26 в паке.
  Решение subsystem=reference СИНХРОНИЗИРОВАНО в build_mechanics_b21.py
  (пересборка байт-идентична, карточки больше не откатываются).
- B2.2 скурирован: hero_creation (38 карт, гл. 3, стр. 28–58) → build_mechanics_b22.py.
  Скелеты hero_creation.* из staging удалены; осталось 52.
- B3 скурирован: traits (7) + rewards_virtues (11) + standard_of_living (3) +
  equipment (3) + endurance_hope (3) + valour_wisdom (2) = 29 карт (гл. 4 «Отличия»
  стр. 60–76 + гл. 5/6 «Доблесть и Мудрость» стр. 78–90) → build_mechanics_b3.py.
  Скелеты этих 6 subsystem'ов из staging удалены; осталось 23 (это B4/B5).
  B3 — владелец таксономий, чьи ключи провизорно проставил B2.2: 18 навыков
  (traits.spisok_navykov), 4 Боевых умения + правило Драки (traits.spisok_boevyh_umeniy),
  24 Отличительных качества (traits.spisok_otlichitelnyh_kachestv), 6 Наград
  (rewards_virtues.spisok_nagrad), 6 Особенностей (rewards_virtues.spisok_osobennostey),
  6 Образов жизни (standard_of_living.*). Ключи НЕ менялись → пак джойнится без правок b22.
  36 Культурных особенностей (6 культур × 6) — net-new провизорные ключи, см. карты
  rewards_virtues.osobennosti_<culture>.
  Правка B2.1 (Развилка #2): notes conditions.miserable и checks.favoured_edge_cases
  перенацелены — «снятие несчастья» → endurance_hope.nadezhda (стр. 71, закрыто B3),
  «подавлен страхами» → shadow (стр. 137/139). Diff vs прежнего дерева = ровно эти 2
  notes (всё прочее в обеих карточках байт-идентично) + 29 новых файлов.

ВСЕГО в паке сейчас: 33 verified-таблицы (solo+lifepaths, не трогать) +
93 rule_card. Гейты зелёные: validate 126/126, independent_check 575/575.
Пересборка всех 3 build-скриптов байт-идентична.

## РЕШЕНИЯ ИВАНА (применены к дереву этого архива — свежая сессия ОБЯЗАНА
## синхронизировать их в build-скрипты, иначе пересборка откатит):
1. subsystem "reference" ДОБАВЛЕН в enum rule_card.schema.json. Три служебные
   карточки переведены: reference.character_sheet, reference.game_terms,
   reference.procedure_steps (бывшие checks.*). В build-скрипте B2.1 эти три
   карточки тоже должны получить subsystem="reference" и новый id — иначе
   следующая пересборка вернёт им checks. ПЕРВЫМ ДЕЛОМ сверить.
2. game_terms оставлена как есть (OCR-шум узаконен ADR-002).
3. keeper_tools-сироты (kak_ustroena_faza_priklyucheniy, sessii_fazy_priklyucheniy)
   приписаны к B5.

## РЕШЕНИЯ B2.2 (применены; B3+ ОБЯЗАН следовать)
- Канон-словарь ключей зафиксирован в build_mechanics_b22.py: SKILL_ORDER (18
  навыков), weapon-skills brawling/swords/spears/axes/bows, culture_id = ключи
  lifepaths, calling/standard_of_living-ключи. B3 (traits.spisok_navykov и пр.)
  ПЕРЕИСПОЛЬЗУЕТ их без расхождений. Ключи качеств/даров/наград/Путей Тени —
  провизорные движок-идентификаторы; канонизирует B3/B-later
  (traits / valour_wisdom / rewards_virtues / shadow), но ключи менять синхронно.
- Зависимости hero_creation от B3 выражены КЛЮЧАМИ в parameters (резолв при
  загрузке пака), не рёбрами related: related без висячих kv.mechanics.*,
  forward-указатели на B3 — в notes. Тот же приём, что в B2.1.
- ДВА межбатчевых флага дублей разобраны — НЕ дубли, а одинаковый заголовок на
  разных страницах (как флаг 2 B2.1): «Боевое снаряжение» (hero_creation стр.
  47–49 = таблица оружия/брони, vs equipment стр. 73 = пассаж про отряд Арагорна)
  и «Отличительные качества» (hero_creation стр. 30 = вводная в блоке культур, vs
  traits стр. 67 = правила механики). B2.2 взял hero_creation-версии; twin-скелеты
  equipment.boevoe_snaryazhenie и traits.otlichitelnye_kachestva ОСТАВЛЕНЫ в
  staging для B3.

## ДЛЯ B3: контракт джойна с hero_creation (точные ключи — в build_mechanics_b22.py)
Карты B3 должны существовать под id = ключ, на который ссылается hero_creation
(резолв ключей parameters при загрузке пака). Семейства ключей, уже проставленные
в B2.2 (полные списки — константы и карточки в build_mechanics_b22.py):
- НАВЫКИ (18): SKILL_ORDER — traits (список навыков) ОБЯЗАН использовать эти ключи.
- БОЕВЫЕ УМЕНИЯ (5): brawling/swords/spears/axes/bows — traits.
- ОБРАЗ ЖИЗНИ (6): poor/frugal/common/prosperous/rich/very_rich — standard_of_living.
- ОТЛИЧИТЕЛЬНЫЕ КАЧЕСТВА (24, объединение по культурам): proud, conspicuous, fair,
  stubborn, ardent, fierce, bold, generous, noble, secretive, witty, suspicious,
  grim, faithful, sincere, inquisitive, courteous, simple, patient, swift, refined,
  honest, merry, keen_eyed — traits (полный список + правила, стр. 67).
- КУЛЬТУРНЫЕ ДАРЫ (6+2 вторичных): valour_favoured, armour_load_halved, bree_blood,
  kings_of_men, hobbit_sense, elven_skill, allegiance_of_dunedain, the_long_defeat —
  rewards_virtues (культурные особенности по народам).
- ДОП. КАЧЕСТВА ПРИЗВАНИЙ (6): folklore, enemy_lore, shadow_lore, burglary,
  rhymes_of_lore, leadership — traits/rewards_virtues.
- СТАРТОВЫЕ НАГРАДЫ (6): fell, keen, close_fitting, grievous, reinforced, well_fitted;
  СТАРТОВЫЕ ОСОБЕННОСТИ (6): strong_grip, mastery, nimbleness, hardiness, confidence,
  prowess — valour_wisdom / rewards_virtues (главы про Награды/Особенности, стр. 78–80).
- ПУТИ ТЕНИ (6): wandering_madness, vengeance, despair, dragon_sickness, secrets,
  power — это B-later (shadow), НЕ B3; просто не противоречить.
Ключи качеств/даров/наград/Путей Тени в B2.2 — ПРОВИЗОРНЫЕ движок-идентификаторы.
Если B3 при канонизации меняет написание ключа — правка в build_mechanics_b22.py
И build-скрипте B3 В ОДНОМ ИЗМЕНЕНИИ (детерминизм; пересборка байт-идентична).

## ОСТАЛОСЬ (батчи курирования)
- B3 — СДЕЛАН (см. «Где мы»). Разбор трёх флагов, чтобы не повторять:
  ВАЖНО-1 (БЫЛО НЕВЕРНО): «подавлен страхами» / приступ безумия НЕ на стр. 71 и
  НЕ в endurance_hope. Оба вхождения сидят в главе «Тень» (ПОСЛЕДСТВИЯ ПОЛУЧЕНИЯ
  БАЛЛОВ ТЕНИ → ЗАКАЛКА ДУХА, стр. 137/139) = B-later (shadow). endurance_hope.nadezhda
  (стр. 71) покрывает ТОЛЬКО базовый порог несчастья (Тень ≥ ТЕКУЩЕЙ Надежды) +
  восстановление Надежды + снятие несчастья. Notes B2.1 уже перенацелены.
  ВАЖНО-2 (джойн): подтверждён — id всех 29 карт B3 совпали с ключами parameters
  из B2.2; «id = ключ» трактован как runtime-реестр (не per-key файлы), карты-владельцы
  таксономий несут полный реестр key→def в parameters. Пак джойнится без правок b22.
  ВАЖНО-3 (twin-флаги): equipment.oruzhie / bronya_i_schity = ОПИСАНИЯ типов (без
  чисел); числовые таблицы — в hero_creation.combat_gear (B2.2). Комплементарны, не
  дубли. Требования Образа жизни к снаряжению (стр. 100) — в диапазоне гл. «Бой», B4.
- B4: combat (~10, самые плотные parameters: шаги раунда, атаки, ранения, задачи).
  Здесь же: сама проверка атаки против ЦЧ СИЛЫ (стр. 93), серьёзные травмы / Пронзающий
  удар (стр. 101), требования Образа жизни к снаряжению (стр. 100).
- B5: council + journey + fellowship_phase + 2 keeper_tools-сироты (~17).
  Здесь: сцены пути и Изнурение (стр. 108), йольские начинания, в т.ч. «Поведать
  историю» (замена Отличительных качеств), «Изменение качеств» из стр. 68.
- shadow (B-later): порог «подавлен страхами», приступ безумия, Пути Тени, ЗАКАЛКА
  ДУХА (стр. 136–139); сопротивление Тени для Доблести/Мудрости (стр. 136).
- Финал: validate (expected_count поднять!), independent_check, гейты 2a/2b/3
  по ADR-002, затем:
  python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics \
    --gate2 "<vision/semantic evidence>" --gate3 "<lynn-review evidence>"

## Гейт 2b (vision-spotcheck) — РАЗБЛОКИРОВАН, источник найден
ИСТОРИЯ: файл в /mnt/project/КВ_…pdf был деградированным текст-огрызком (1 МБ, без
%PDF; = source_kv/kv_core.txt). Иван дозагрузил НАСТОЯЩУЮ книгу ядра: %PDF-1.7,
242 стр., текстовый слой + вёрстка/иллюстрации, sha256 в content-packs/kv/gate2b_evidence/
MANIFEST.md. ЭТО и есть источник гейта 2b (картинки страниц).
- СМЕЩЕНИЕ: PDF-страница = книжный фолио + 1 (подтверждено на фолио 30/46/48/73/80).
- rasterize: pdftoppm -jpeg -r 135 -f <PDF#> -l <PDF#> <pdf> out
- ПЕРЕБАЗИРОВКА РЕЗА НА ЭТОТ PDF — ОТКЛОНЕНА. Диф: слои почти равны по объёму (та же
  книга), но дословно совпали лишь 39/102 source_text-ячейки; промахи — НЕ другие
  слова (выборка посимвольно идентична на сотни знаков), а другой порядок линеаризации
  (pdftotext вмешивает сайдбары в колонку; огрызок чище). Пере-резка сломала бы гейт 1
  для ~60% ячеек → полное ре-курирование 93 карт ради нулевого выигрыша. Поэтому
  kv_core.txt остаётся источником РЕЗА (гейт 1), настоящий PDF — источник ВИЖН (гейт 2b).
- ADR-002: сверяются ТОЛЬКО числа parameters/таблицы; проза со сканами не сверяется.
  ВНИМАНИЕ: на табличных/многоколоночных страницах текстовый слой PDF переколонивает
  блоки (заголовок одной строки липнет к телу другой) — числа ОБЯЗАТЕЛЬНО сверять по
  КАРТИНКЕ, не по pdftotext (проверено на virtues стр. 80).

### Сверено вижном, 0 расхождений (страницы-доказательства в source_pages/):
skills_and_weapon_skills (ф.30), previous_experience (ф.46), combat_gear (ф.48: 16
оружий+5 брони+3 щита), standard_of_living (ф.73: 0/30/90/180/300+), spisok_osobennostey
(ф.80: 6 эффектов), spisok_nagrad (ф.79–80: 6 эффектов). «Пробел» previous_experience
оказался не пробелом — таблицы намеренно обрываются на ур.4/3 (на 10 баллов выше не купить).

### Осталось для 2b (фреш-сеанс, батчем) — всё число-плотное, многое таблицы → вижн:
- культурные стат-блоки ×6 (ф.32–43): characteristic_sets/derived/skills/weapon_skills
- Культурные особенности ×6 = 36 эффектов (ф.81–90)
- ponies_and_horses (ф.50–51), useful_items (ф.49–50), starting_rewards_and_virtues (ф.51)
- скаляры: valour_wisdom (ф.78), endurance_hope recovery (ф.69–72), derived/fellowship/companion

## Как продолжить в новом чате
Прикрепить этот архив, сказать: «Продолжаем сессию 3a по HANDOFF_3A.md, B4».
Куратор читает source_text скелета С ДИСКА (view tools/extraction/staging_3a/X.json),
пишет summary/parameters в build-конфиг, НЕ пересказывая цитаты; числа — только
из source_text. После переноса карточки — удалить её скелет из staging.

## Дисциплина (нерушимое)
- Цитаты source_text вырезаются из слоя якорями, не перепечатываются.
- Правки — в build-скрипт (источник правды), не в JSON напрямую (детерминизм).
- При расхождениях внутри КВ канон — тело core book; сверять по слою прежде
  чем «чинить» (флаг 2 B2.1 оказался не ошибкой книги, а двумя порогами).
- verified ставит только mark_verified после трёх зелёных гейтов.
