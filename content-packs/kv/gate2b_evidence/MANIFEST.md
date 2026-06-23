# Gate 2b vision source — real КВ core PDF

Источник гейта 2b (ADR-002, vision-spotcheck чисел) — НАСТОЯЩАЯ книга ядра,
а НЕ `source_kv/kv_core.txt` (тот — деградированный 1-МБ текст-огрызок, остаётся
источником РЕЗА для гейта 1; перебазировать рез на этот PDF отклонено — см. HANDOFF).

- file (у Ивана): КВ_02_03_2026_с_рубрикатором__1_.pdf
- sha256: 9f40bf9f0c2b5c9d96544e6d71467b1fbe25644fa551070e28242ddb61e5a24d
- pages: 242 (настоящий %PDF-1.7, текстовый слой + вёрстка/иллюстрации)
- СМЕЩЕНИЕ СТРАНИЦ: PDF-страница = книжный фолио + 1 (подтверждено на фолио 30/46/48/73/80)
- rasterize: pdftoppm -jpeg -r 135 -f <PDF#> -l <PDF#> <pdf> out

## Verified clean (0 расхождений), 2026-06-23
| Карта | Фолио | Что сверено |
|---|---|---|
| skills_and_weapon_skills | 30 | рейтинг 0–6; метки навыков/умений |
| previous_experience | 46 | 10 баллов; стоимости 1/2/3/5 и 2/4/6 |
| combat_gear | 48 | 16 оружий + 5 брони + 3 щита (все поля) |
| standard_of_living | 73 | лестница 0/30/90/180/300+; старт 180 |
| spisok_osobennostey (virtues) | 80 | все 6 эффектов (привязка+магнитуды) |
| spisok_nagrad (rewards) | 79–80 | все 6 эффектов (текст: 9, +2, −2, +1...) |
| cultural stat blocks ×6 | 32–43 | characteristic_sets/derived/skills/weapon_skills — 246 чисел, 0 расхождений (reproducible: `tools/extraction/verify_gate2b_cultures.py`) |
| cultural features ×6 (36 virtues) | 81–90 | имена+count 36 особенностей и 14 числовых магнитуд (endurance/hope max, parry +2, тяга 4, Травма 12…) + семантика построчно — 0 расхождений (reproducible: `tools/extraction/verify_gate2b_cultural_features.py`) |
| starting gear ×3 | 49–51 | useful_items (кол-во по достатку 0/1/2/3/4/4, max 1), ponies_and_horses (тяга 0/0/1/2/3/3, кладь 10), starting_rewards_and_virtues (Доблесть/Мудрость старт 1, 6 наград + 6 особенностей) — 22 числа, 0 расхождений (reproducible: `tools/extraction/verify_gate2b_starting_gear.py`) |

## Осталось для 2b (фреш-сеанс, батчем)
- скаляры: valour_wisdom (78), endurance_hope recovery (69–72), derived/fellowship/companion
