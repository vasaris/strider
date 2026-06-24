# HANDOFF — gate-2a re-confirm КВ-ядро (4 тронутые F1/F2/F3-карты + F4-карта)

**Подготовлено АВТОРСКОЙ сессией** (применившей F1/F2/F3/J5 @`636171d` и F4 @`0becd6b`), для **свежей НЕ-АВТОРСКОЙ re-confirm сессии**.
**Граница ADR-001:** это **шаг 2 gate-2a** (быстрый re-confirm). Его НЕЛЬЗЯ выполнять авторской сессией, которая делала правки. Ты — **фреш-инстанс, который эти карты НЕ строил и НЕ правил**. Ты подтверждаешь, что приземлённые правки корректны и изменённые `parameters`/рёбра не вводят в заблуждение. Ты НЕ ведёшь gate-3 и НЕ ставишь `verified` (это `mark_verified.py` после gate-3).

**Скоуп:** только КВ-ядро (`book=kv_core`, 140 карт, все `verified:false`). Не трогать 49 ИдО `solo.*` и таблицы. **Ничего не правишь** — это ревью-шаг; находки (если будут) маршрутизируешь обратно автору. Если всё чисто — выдаёшь PASS-вердикт и передаёшь в gate-3.

---

## 0. КОНТЕКСТ: что было применено (предмет re-confirm)

gate-2a ревьюерская сессия нашла на 140 КВ-картах: **138 SUPPORTED / 2 PARTIAL / 0 UNSUPPORTED** (`docs/GATE2A_KV_FINDINGS.md`), плюс под-линкинг F3 и косметику J5. Авторская сессия применила:

- **F1** — `eye.bditelnost_oka`: триггер роста ВЗОР ОКА был закодирован неверным референтом («знак успеха ✶» из глоссария). Исправлено: `parameters.growth.eyes_gaze.trigger = "eye_on_feat_die out_of_combat"`; `notes` переписаны на Око-резолюцию без скана. `source_text`/`summary` не тронуты.
- **F2** — `shadow.bally_teni`: `miserable_effect` был самопротиворечив (`success_sign_on_feat_die…`). Исправлено: `"eye_on_feat_die = auto_failure"` — точное зеркало `conditions.miserable.parameters.effect`.
- **F3** — под-линкинг: `checks.who_rolls.related += checks.assistance` (STRONG); `checks.which_ability.related += traits.navyki, traits.boevye_umeniya, valour_wisdom.doblest, valour_wisdom.mudrost` (MODERATE); `checks.retry.related = []` (WEAK — оставлено пустым, защитимо).
- **J5** (косметика) — `combat.vyhod_iz_boya.section`: «Фаза»→«фаза» (привод к 8/9 строчным combat-картам). Не влияет на семантику.
- **F4** (числа по скану, gate-2b) — `fellowship_phase.struktura_fazy_bratstva`: стаб `training_cost.status=pending_gate_2b` разрешён в таблицу по скану фолио 119 (`gate2b_evidence/MANIFEST.md` + `verify_gate2b_training_cost.py`). C1 «уровень навыка/умения» = пиктограммные пипсы 1–6, C2 «уровень Доблести/Мудрости» = none,2,3,4,5,6, C3 «цена» = 4/8/12/20/26/30; привязка построчно.

---

## 1. НЕРУШИМЫЕ ПРИНЦИПЫ (не пересматривать молча)

1. Механика не живёт в LLM (детерминированный код). 2. Оракулы — механика движка. 3. `engine/` без контента. 4. RNG сидируемый. 5. Без `verified:true` (ставит только `mark_verified.py`) в прод не грузится. 6. Контур приватный (никаких публикаций/монетизации).
- **Терминоканон Пандора Бокс**: Хранитель, Кость испытания, Кости успеха, Изнурение, баллы Тени, Надежда, ЦЧ, благополучный/злополучный бросок, Бдительность Ока, Фаза братства.
- **Рун-канон:** Кость испытания d12: 11 = Око, 12 = руна Гэндальфа.
- **Источники правды:** (1) `brodyazhnik-architecture-v1.md`, (2) книга (правило — по ней, не по памяти), (3) решения в диалогах.
- **Метод разрешения глифов без скана** (обоснование F1/F2) — в `GATE2A_KV_FINDINGS.md` §«Метод разрешения глифов БЕЗ скана». Скан для re-confirm F1/F2/F3 **не нужен**.

---

## 2. РАБОЧИЙ РЕЖИМ

- Формат — два блока: «**ДЛЯ ИВАНА**» (что/зачем + ASCII-команды) и «**ДЛЯ CLAUDE CODE DESKTOP**» — **ПУСТО**.
- Это **ревью**, не правка: JSON/скрипты не трогаешь. Если находишь дефект — пишешь вердикт-находку (как ревьюер в `GATE2A_KV_FINDINGS.md`), маршрутизируешь автору, **сам не чинишь**.
- Стандарт 110/100 + честная самооценка с pushback. Кириллица в shell-командах — никогда (файлы ASCII-маской). Коммиты (если понадобятся для вердикт-дока) — `-m`, ASCII.

---

## 3. ТЕКУЩЕЕ СОСТОЯНИЕ (HEAD на момент архива ≈ `0becd6b`)

- 140 КВ-ядро `rule_card`, все `verified:false`.
- Базовые гейты зелёные: `validate` 222 · `independent_check` 676/0 · `check_param_numbers` без дублей · `check_determinism` byte-identical.
- gate-2b КВ закрыт полностью, включая F4 (`gate2b_evidence/MANIFEST.md`).
- gate-2a (семантика) применён; этот документ — шаг 2 (re-confirm применённого).

---

## 4. ЗАДАЧА — re-confirm (механический + семантический)

### 4a. Механические проверки (прогнать, вставить вывод)
```
python3 tools/extraction/validate.py
python3 tools/extraction/independent_check.py
python3 tools/extraction/check_param_numbers.py
python3 tools/extraction/check_determinism.py
python3 tools/extraction/confirm_kv_gate2a_fixes.py
python3 tools/extraction/verify_gate2b_training_cost.py
```
Ожидаемо: `OK 222` · `failures: 0` · без дублей · `byte-identical` · `PASS F1+F2+F3 ok` · `PASS (0 mismatches)`.

### 4b. Семантический re-read 5 карт (по книге, НЕ по памяти)
Подтвердить для каждой, что правка делает вердикт **корректным** и не вводит в заблуждение:

| карта | что проверить | ожидаемый итог |
|---|---|---|
| `eye.bditelnost_oka` | `growth.eyes_gaze.trigger` = Око (не «знак успеха»); модификаторы `amount:1 / tense:two_or_more / safe:0` согласованы с нетронутым `summary` («вне боя +1, напряжённо +2+, в безопасном месте 0»); `notes` не вводят в заблуждение | Content **SUPPORTED** (был PARTIAL) |
| `shadow.bally_teni` | `miserable_effect` = `eye_on_feat_die = auto_failure` — точное зеркало `conditions.miserable.parameters.effect`; не самопротиворечив | Content **SUPPORTED** (был PARTIAL) |
| `checks.who_rolls` | `related = [checks.assistance]` — ребро в правило Помощи (карта операционно вводит правило Помощи) | edge **OK** (под-линк применён) |
| `checks.which_ability` | `related` = 4 цели (`traits.navyki`, `traits.boevye_umeniya`, `valour_wisdom.doblest`, `valour_wisdom.mudrost`) — способности 3 типов проверок; все существуют (нет висячих) | edge **OK** (под-линк применён) |
| `fellowship_phase.struktura_fazy_bratstva` | `training_cost`-таблица не противоречит `summary`/`source_text`; привязка построчно как в `gate2b_evidence/MANIFEST.md` (ф.119); `notes` корректно помечают C1 как пиктограммную scan-only колонку | Content **SUPPORTED**, числа gate-2b-closed |

Заодно `checks.retry.related = []` — подтвердить, что пусто **защитимо** (самодостаточное мета-правило; WEAK).

### Финиш (вердикт)
Все механические проверки PASS **и** семантический re-read подтверждает: 2 ex-PARTIAL теперь SUPPORTED, F3-рёбра корректны, F4-таблица согласована со сканом-evidence. Вывод — короткий PASS-вердикт (можно дописать секцию в `GATE2A_KV_FINDINGS.md` «## RE-CONFIRM @<commit> — PASS» или отдельный `GATE2A_KV_RECONFIRM.md`). `verified` НЕ трогать.

---

## После этого брифа
1. **gate-3 (lynn-review)** — отдельная свежая НЕ-авторская сессия (ADR-001) по `docs/lynn_review_brief_stage0_session*.md`; читает финальные 140 КВ (+ 49 ИдО, если ещё не стэмпнуты). Идёт ПОСЛЕДНИМ из ревью (видит то, что станет `verified`).
2. **Штамп (механический, после gate-3):**
```
# ЭРРАТУМ: БЕЗ --id-prefix. `kv.` резолвится в `kv.mechanics.kv.` = 0 eligible (штампует НИЧЕГО).
# 49 ИдО уже verified -> idempotent-skip; флипнутся только 140 КВ.
python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics \
  --gate2 "2a:GATE2A_KV_FINDINGS.md @0becd6b + F1/F2/F3 re-confirm; 2b:gate2b_evidence/MANIFEST.md incl. training_cost(F4)" \
  --gate3 "<lynn evidence>"
```
Подставить реальную lynn-строку из gate-3. Практичнее запускать из gate-3 сессии (evidence под рукой). → **выход Stage 0**.

## /goal (готов к вставке — Claude Code, auto mode)
```
/goal Run the gate-2a re-confirm for the touched KV-core cards per docs/HANDOFF_KV_GATE2A_RECONFIRM.md.
You are a NON-AUTHOR review instance (ADR-001): do NOT edit any JSON or scripts, do NOT set verified, do NOT run gate-3.
First run the four base gates plus confirm_kv_gate2a_fixes.py and verify_gate2b_training_cost.py and paste output.
Then semantically re-read 5 cards against the book: eye.bditelnost_oka (trigger=Eye, modifiers match summary),
shadow.bally_teni (miserable_effect mirrors conditions.miserable), checks.who_rolls (related=[checks.assistance]),
checks.which_ability (related = the 4 ability cards), fellowship_phase.struktura_fazy_bratstva (training_cost matches
the folio-119 gate-2b evidence). DONE when: validate.py OK 222; independent_check.py failures: 0; check_param_numbers
no duplicates; check_determinism byte-identical; confirm_kv_gate2a_fixes.py prints "PASS F1+F2+F3 ok";
verify_gate2b_training_cost.py prints "PASS (0 mismatches)"; and you have written a short RE-CONFIRM PASS verdict
(2 ex-PARTIAL now SUPPORTED, F3 edges correct, F4 table consistent). CONSTRAINTS: review only, never edit; if any card
fails re-read, record a finding for the author and STOP. Stop after 20 turns.
```

---
*Самооценка автора по этому хэндоффу: эдит-сайты и целевые значения выверены и зелены в авторской сессии; re-confirm — дёшев (механика воспроизводима, семантика — 5 карт). Слабое место: re-confirm полагается на тот же «метод разрешения глифов без скана», что и сами правки — но это независимо проверяемо по книге (греп «выпадает знак», самоопределение «Знак…=0»), скан для F1/F2 не требуется; F4 покрыт сканом+verifier.*
