# STARTER — Бой, такт 5 (Выход из боя + соло-цикл раунда / интеграция)

**Вставь это первым сообщением в новый чат того же Project. Прикрепи свежий репо-зип на HEAD `e28b6bb`.**
Конституция/дисциплина — в инструкциях Project и в `docs/HANDOFF_COMBAT.md` (§0–1). Эта дока самодостаточна и **заменяет** `STARTER_COMBAT_TACT4.md`: что готово после такта 4, какие решения НЕ переоткрывать, долги к закрытию и куда смотреть в разведке такта 5.

---

## 0. Режим

**MODE: BUILD.** Ты — ведущий инженер движка «Бродяжник». Язык общения русский, код английский. Трёх-такт (скелет → «го» → реализация+тесты). Стандарт 110/100 с pushback. `/goal`: рутину решай сам, на подтверждение — только настоящие развилки. Два блока: «ДЛЯ ИВАНА» / «ДЛЯ CLAUDE CODE DESKTOP» (второй пустой). Тройной прогресс-бар в подписи каждого сообщения: «осталось X% от такта / подсистемы Бой / этапа Stage 1». Протокол сдачи: песочница `/home/claude/work/`, артефакт-зип `engine` (без node_modules) + **sha256** + ASCII-команды; коммит из корня (`cd ~/Downloads/brodyazhnik && git add engine && git commit -m "<ascii>"`).

Первый шаг сессии — **сверка сборки**: `cd engine && npm install && npm run typecheck && npm test` → ожидаю **224 зелёных**, typecheck чист; `npm run journey` (golden `dark-1` → `durationDays: 8`).

## 1. Что готово (HEAD `e28b6bb`, 224 теста)

Базовые 8 подсистем (см. `HANDOFF_COMBAT.md §2`) + **Бой такты 1–4**:

| Такт | Коммит | Что даёт | Файлы |
|---|---|---|---|
| Combat 1 | `edb9fe6` | Боевое состояние, стат-блок врага, стойки/задачи (config-from-pack) | `src/combat/{types,config,enemy,fromPack,parse,index}.ts` |
| Combat 2 | `e147624` | Разрешение атаки: боевое умение → попадание → урон Выносливости; инверсия Кости испытания врага; стойки/осложнения как Кости успеха; Отброшен | `src/combat/{attack,configs}.ts` |
| Combat 3 | `d253468` | Раны/тяжесть/первая помощь/умирающий; особый урон героя (Сокрушительный/Отражение/Укол/Толчок щитом); Пронзающий (защитный бросок) | `src/combat/{wounds,specialDamage}.ts` |
| Combat 4 | `e28b6bb` | **Противники:** рана врагу (`applyEnemyWound`, долг №1 закрыт), `after_battle`, пул Ненависти/Решимости (cap=Мощь/раунд, →уставший), соло-ведение через таблицу ответов | `src/combat/{adversary,soloConduct}.ts` |

`src/combat/adversary.ts`: `applyEnemyWound` (инкремент `woundsTaken`→Мощь→уничтожен), `afterBattle(enemy, survives)`, `isTakenOutSurvivable`, `spendPool` (≤pool, ≤Мощь/раунд, `grantedDice`, →weary), `resetRoundPool`, `enemyIsWeary`.
`src/combat/soloConduct.ts`: `rollEnemyDecision(kind, likelihood)` поверх `rollAnswer` (kinds: `activate_ability/press_or_flee/surrender/survives_defeat`); `resolveEnemySurvival` (единственный мутирующий kind → `afterBattle`).
Тесты бой: `config 8 + enemy 7 + attack 18 + wounds 25 + specialDamage 18 + adversary 17 + soloConduct 6 = 99`.

## 2. Решения тактов 1–4 — НЕ переоткрывать, не противоречить

- **Раны героя персистентны на `HeroState`** (severity/healingDays/marked/dying/dead/permanentInjuryMarks). Тяжесть структурна (руна→Лёгкая, число→Серьёзная(дни=числу), Око→Ужасная→умирающий). Все числа из пака.
- **Пронзающий симметричен** (`resolvePiercing(defenderSide, …)`). **Особый урон — только герой** (`applySpecialDamage` чист; враг-особый-урон непрозрачен).
- **`CombatConfigs`** — агрегат (`combat/attack/wounds/specialDamage/check/conditions/dice`); резолверы в пак не лезут.
- **Combat 4 (R1) — два исхода врага различимы:**
  - Выносливость 0 → `engaged=false`, **`alive=true`** (выведен, дышит); выживание решает `afterBattle`. `AttackOutcome.targetTakenOut` (НЕ `targetDestroyed`).
  - `woundsTaken === might` → `engaged=false, alive=false` (уничтожен). `alive=false` — **только** подтверждённая смерть.
- **Пул врага:** `spendPool` enforced `amount ≤ pool` И `poolSpentThisRound + amount ≤ might`; даёт `grantedDice = amount`; `pool 0 ⇒ enemyIsWeary`. `poolSpentThisRound` — round-local поле на `EnemyState` (как `drivenBackUsedThisRound` у героя).
- **Способности врага непрозрачны.** Движок учитывает только пул и валидирует трату, переданную игроком; что Способность делает — не моделируем. **Выбор действия/цели/оружия врага — суждение игрока** (соло-коллапс + «принцип крутизны»), не движок: движок владеет костями, не тактикой. Через оракул идут только бинарные неопределённости (`soloConduct`).
- Инвариант: ноль кириллицы в `src` (кроме `eye/types.ts:4`, known-minor), ноль импортов пака, ноль книжных литералов.

## 3. Долги, которые закрывает БОЙ такт 5 (флаги, не блокеры)

1. **`resetRoundPool` ещё никто не зовёт** — цикл раунда обнуляет `poolSpentThisRound` на границе раунда.
2. **`grantedDice` из `spendPool` не вплетён в `resolveAttack`** — экономика действий цикла решает, когда враг тратит пул за +Nк (атака/защита). Не лезь в `resolveAttack` (такт 2) точечно — оберни на уровне цикла.
3. **Особый-урон-данные героя** (`applySpecialDamage` чист) — цикл применяет добавочный урон/раунд-баффы к состоянию.
4. **Восстановление стойки после Отброшен** (`drivenBackUsedThisRound` сброс + трата главного действия на восстановление) — экономика действий цикла.
5. **Суточный цикл Отдыха** (`healingDays` убыль, `clearLightWoundAfterCombat`, снятие метки при долечивании) — хук после боя; вероятно отдельный такт восстановления, не внутри цикла раунда.
6. **Гейтинг первой помощи** (раз на рану / retry через день) — temporal-политика, на уровне цикла, не в `firstAid`.
7. **⚠️ Контент-зависимость (gate-сессия, НЕ движок):** соло-оверлей боя — карты `kv.mechanics.solo.{manevrennaya_poziciya, manevrennaya_poziciya_dalniy_boy, oslozhneniya_preimushchestva_solo, prodvinutsya}` имеют `parameters:{}` (verified текст, но без структурных полей). **Базовый combat-config дерайвится полностью** (стойки/задачи есть из `shagi_v_raunde_blizhnego_boya`/`boevye_zadachi`), поэтому ядро цикла раунда строить можно. Но соло-специфику стойки/задачи «Продвинуться»/манёвренной позиции нельзя чисто дерайвить, пока эти 4 карты не получат структурный backfill в gate-сессии. Не строй соло-оверлей-резолвер на пустых `parameters` — сначала backfill.

## 4. ТЕКУЩАЯ ЗАДАЧА — такт 5: Выход из боя + соло-цикл раунда

**Первый шаг — РАЗВЕДКА пака (как всегда), не код. Читай дословный текст карт:**
- `combat.vyhod_iz_boya` (`parameters.methods`) — способы выхода (стрелковый — без броска; оборонительный — проверка атаки). `CombatConfig.exit` уже дерайвится (`ExitMethods`), но **резолвера выхода нет** — это такт 5.
- `combat.posledovatelnost_boya` (`steps: first_volleys → melee_rounds`; залпы; внезапная атака) и `combat.shagi_v_raunde_blizhnego_boya` (`round_steps: position → grapple → take_actions`; `action_order: by_stance forward→open→defensive→ranged`; `actions: main 1 + secondary 1`) — структура цикла.
- `combat.boevye_zadachi` (`tasks`) — стойки уже несут задачу; как задача даёт баффы между раундами (соло-применимость задачи — с учётом backfill из §3.7).
- Соло-карты ведения: `kv.solo.*` уже подключены через `oraclesFromPack` (answers/lore) — переиспользуй, не дублируй.

**Предлагаемое дробление (уточни разведкой — может быть 2 под-такта):**
- **Выход из боя:** `resolveExit` (стрелковый без броска / оборонительный через проверку атаки) поверх `CombatConfig.exit`.
- **Соло-цикл раунда** (аналог `journey/run.ts`, чистые функции + нить RNG): порядок стоек, экономика действий (main+secondary), применение `grantedDice` (долг №2) и особого-урона-данных (долг №3), сброс `poolSpentThisRound`/`drivenBackUsedThisRound` (долги №1,4), восстановление стойки после Отброшен, цели (соло-коллапс: один герой — все враги бьют по нему). Враги ведутся через `soloConduct` (бинарные решения) + суждение игрока (тактика).
- **Боевая сцена как событие** (мост к Stage 2): структурный результат раунда/боя в общий интерпретатор эффектов (`journey/effects.ts` или боевой аналог). Око: **в бою НЕ растёт от Кости испытания** (свериться с `eye_of_mordor` engine_note) — но неудача-Око в бою имеет свои последствия, читай карту.
- **Демо:** CLI боевая сцена на golden-сиде (аналог `npm run journey`), без LLM — детерминированное прохождение боя на тест-Страннике против врага из пака.

**Тесты:** цикл раунда детерминирован на сидах; экономика действий (main/secondary, порядок стоек); применение `grantedDice`/особого урона к состоянию; сброс round-local; `resolveExit` (оба способа).

## 5. Дальше по роадмапу (после Боя)

После закрытия Боя: **Советы** (`council` 3) → **Прогрессия** (`rewards_virtues` 11 + `valour_wisdom` 2, хвост `advancesShadowPath`) → **Фаза братства** (`fellowship_phase` 4, **закрывает механический Stage 1**) → Stage 2 (нарративный слой / AI-Хранитель; evals, промпты, анти-слоп). НЕ из поздних этапов, пока Stage 1 не закрыт, кроме явной просьбы.

## 6. Команды

```
cd engine && npm install && npm run typecheck && npm test   # 224 зелёных
npm run journey                                             # golden dark-1 -> durationDays 8
```

Контент-гейты (Python, про пак, не движок) — из корня репо: `python3 tools/extraction/<script>.py`. Соло-backfill из §3.7 — отдельная gate-сессия (контент-работа), не эта BUILD-сессия.

Контекст-дисциплина: бой большой; предупреждай `🔴 ПОРА В НОВЫЙ ЧАТ` перед следующим крупным куском. Долговечное состояние — git + handoff + пак, не чат.
