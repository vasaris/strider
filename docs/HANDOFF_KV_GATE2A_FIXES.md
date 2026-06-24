# HANDOFF — apply gate-2a КВ-core fixes (F1 + F2 + F3, optional J5)

**Подготовлено gate-2a РЕВЬЮЕРСКОЙ сессией** (дерево `4b616ac`, полные вердикты в `docs/GATE2A_KV_FINDINGS.md`), для **свежей АВТОРСКОЙ сессии**.
**Граница ADR-001:** это АВТОРСКАЯ задача. Её НЕЛЬЗЯ выполнять в gate-2a ревьюерской сессии (которая нашла эти дефекты) и НЕ в gate-3. Ревьюер специфицирует — автор применяет — **другой** свежий инстанс делает быстрый gate-2a re-confirm на 4 тронутых картах, затем gate-3 сертифицирует.
**Скоуп:** только КВ-ядро (`book=kv_core`, 140 карт, все `verified:false`). **Не трогать 49 ИдО `solo.*` карт и их рёбра.** Только скрипты — JSON производный. ASCII-сообщения коммитов, только `-m`.

Что реализуем (из `GATE2A_KV_FINDINGS.md`): **content 138/140 SUPPORTED · 2 PARTIAL** — оба PARTIAL = один класс дефекта (референт «знака» закодирован из глоссария по памяти; правильный референт = **Око**, установлен без скана). Плюс под-линкинг F3 на 2 пустых checks-картах и опциональный косметический нит регистра J5.

**Базовые гейты на `4b616ac` зелёные** (`validate` 222 · `independent_check` 676/0 · `check_determinism` byte-identical · `check_param_numbers` 0 дублей). Правки ниже **не касаются** `source_text`/`summary` → `independent_check` остаётся 676/0; меняются только `parameters`/`notes`/`section` → после ребилда `check_determinism` отражает новый baseline (byte-identical-к-себе), `check_param_numbers` чист (новые значения без целых чисел).

---

## TASK A — править build-скрипты (затем regenerate + commit)

### A1 · F1 — `eye.bditelnost_oka` триггер роста ВЗОР ОКА → **Око** · `tools/extraction/build_mechanics_b7.py`
Сайт — блок `growth.eyes_gaze` (≈стр.120–124):
```python
"eyes_gaze": {
    "trigger": "выпадает знак вне боя (success-sign ✶ per book glossary; "
               "die unspecified — gate-2a)",
    "amount": 1, "tense_situation": "two_or_more", "safe_place": 0,
},
```
Заменить значение `trigger` на Око-референт (mirror вокабуляра `conditions.miserable` = `eye_on_feat_die`):
```python
"trigger": "eye_on_feat_die out_of_combat",
```
(`amount`/`tense_situation`/`safe_place` НЕ трогать — модификаторы +1 / +2-при-напряжённой / 0-в-безопасном-месте уже верны.)

**Плюс `notes` той же карты** в b7.py — убрать вводящую в заблуждение глоссарий-формулировку. Текущая `notes` лезет к «знак = знак успеха ✶ по глоссарию книги». Заменить на резолюцию без скана, напр.:
```
Владелец Бдительности Ока. Референт «знака» в ВЗОР ОКА = Око (Кость испытания):
установлено по книге без скана — самоопределение «Знак … равен 0» = Око; греп
«выпадает знак» = Око 5/5, 0 контрпримеров; «независимо от результата проверки» =
result-independent (поведение Ока). Знаменитое оружие/броня → treasure.
```
(`source_text`/`summary` НЕ менять — gate-1 / independent_check.)

### A2 · F2 — `shadow.bally_teni` miserable-эффект → **Око** · `tools/extraction/build_mechanics_b6.py`
Сайт — стр.106:
```python
"miserable_effect": "success_sign_on_feat_die_counts_as_failure",
```
Заменить на точное зеркало `conditions.miserable.parameters.effect` (та же механика Удручения — кодировка обязана совпадать):
```python
"miserable_effect": "eye_on_feat_die = auto_failure",
```

### A3 · F3 — под-линкинг 2 пустых checks-карт · `tools/extraction/build_mechanics_pilot.py`
Сайты — определения карт (id):
- `kv.mechanics.checks.who_rolls` (≈стр.51) — сейчас `related` отсутствует/`[]`. Добавить (**STRONG** — карта операционно вводит правило Помощи):
```python
"related": ["kv.mechanics.checks.assistance"],
```
- `kv.mechanics.checks.which_ability` (≈стр.61) — добавить (**MODERATE** — определяет способности 3 типов проверок):
```python
"related": ["kv.mechanics.traits.navyki", "kv.mechanics.traits.boevye_umeniya",
            "kv.mechanics.valour_wisdom.doblest", "kv.mechanics.valour_wisdom.mudrost"],
```
- `kv.mechanics.checks.retry` (≈стр.89) — **WEAK / оставить `[]`**. Ревьюер пометил пусто защитимым (самодостаточное мета-правило). Не добавлять, если нет желания; если добавляешь — только `["kv.mechanics.checks.procedure"]`.

Все 5 целей существуют (`checks.assistance`, `traits.navyki`, `traits.boevye_umeniya`, `valour_wisdom.doblest`, `valour_wisdom.mudrost`) — гейты подтвердят отсутствие висячих рёбер.

### A4 · J5 (ОПЦИОНАЛЬНО, косметика — НЕ блокирует стэмп) · `tools/extraction/build_mechanics_b5.py`
Сайт — стр.507, карта `vyhod_iz_boya`: единственная из 9 combat-карт с заглавной «Фаза», остальные 8 — строчная «фаза приключений».
```python
"section": "Фаза приключений → БОЙ → Выход из боя",
```
→ привести к регистру кластера:
```python
"section": "фаза приключений → БОЙ → Выход из боя",
```
(Чисто косметика регистра `section`; на семантику/`verified` не влияет. Можно отложить.)

### Regenerate + commit (A)
```
cd ~/Downloads/brodyazhnik
python3 tools/extraction/build_mechanics_b7.py
python3 tools/extraction/build_mechanics_b6.py
python3 tools/extraction/build_mechanics_pilot.py
python3 tools/extraction/build_mechanics_b5.py
python3 tools/extraction/validate.py
python3 tools/extraction/independent_check.py
python3 tools/extraction/check_param_numbers.py
python3 tools/extraction/check_determinism.py
git add tools/extraction/build_mechanics_b5.py tools/extraction/build_mechanics_b6.py tools/extraction/build_mechanics_b7.py tools/extraction/build_mechanics_pilot.py content-packs/kv/mechanics
git commit -m "kv-core gate-2a fixes: eye.bditelnost_oka trigger=Eye (F1), shadow.bally_teni miserable_effect=Eye (F2), checks under-linking who_rolls+which_ability (F3), combat section register (J5)"
```
Ожидаемо: `validate` OK 222 · `independent_check` failures: 0 (текст не тронут) · `check_param_numbers` без дублей · `check_determinism` byte-identical.
*(Если правишь по одной находке — пересобирай только её скрипт; для пакетной правки прогони все 4, как выше.)*

### Edge/param re-confirm (gate-2a шаг 2 — выполнить после A и вставить вывод)
Сохранить как `tools/extraction/confirm_kv_gate2a_fixes.py` (или прогнать инлайн):
```python
import json, glob
cards = {}
for p in glob.glob("content-packs/kv/mechanics/*.json"):
    d = json.load(open(p, encoding="utf-8")); cards[d["id"]] = d["payload"]
bad = 0
# F1
trg = cards["kv.mechanics.eye.bditelnost_oka"]["parameters"]["growth"]["eyes_gaze"]["trigger"]
if "eye_on_feat_die" not in trg or "success-sign" in trg or "знак успеха" in trg:
    print("F1 FAIL: eyes_gaze.trigger =", trg); bad += 1
# F2
me = cards["kv.mechanics.shadow.bally_teni"]["parameters"]["miserable_effect"]
if me != "eye_on_feat_die = auto_failure":
    print("F2 FAIL: miserable_effect =", me); bad += 1
# F3
wr = cards["kv.mechanics.checks.who_rolls"].get("related", [])
if "kv.mechanics.checks.assistance" not in wr:
    print("F3 FAIL who_rolls ->", wr); bad += 1
wa = cards["kv.mechanics.checks.which_ability"].get("related", [])
need = {"kv.mechanics.traits.navyki","kv.mechanics.traits.boevye_umeniya",
        "kv.mechanics.valour_wisdom.doblest","kv.mechanics.valour_wisdom.mudrost"}
if not need.issubset(set(wa)):
    print("F3 FAIL which_ability ->", wa); bad += 1
print("KV gate-2a re-confirm:", "PASS F1+F2+F3 ok" if bad == 0 else f"FAIL ({bad})")
```

---

## После этого брифа
1. **АВТОР** применяет TASK A (+ re-confirm PASS); коммитит. (J5 — по желанию, тем же или отдельным коммитом.)
2. **Независимый gate-2a re-confirm на 4 тронутых картах** (`eye.bditelnost_oka`, `shadow.bally_teni`, `checks.who_rolls`, `checks.which_ability`) — **другим** свежим инстансом (ADR-001): изменённые `parameters`/рёбра не должны вводить в заблуждение, F1/F2 теперь Око-канон. Дёшево.
3. **gate-3 (lynn-review)** — отдельная свежая сессия (ADR-001), читает финальные 140 КВ + (если ещё не стэмпнуты) 49 ИдО.
4. **F4 (отдельно, со сканом, НЕ блокирует):** `fellowship_phase.struktura_fazy_bratstva.parameters.training_cost` остаётся `status:pending_gate_2b` — лестница 4/8/12/20/26/30, привязка уровень↔цена по скану фолио 119–120. Разрешить отдельной задачей; `summary` цен не утверждает, карта SUPPORTED.
5. **Выход Stage 0:** `python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics --gate2 "<2a:GATE2A_KV_FINDINGS.md @<commit> + F1/F2/F3; 2b:gate2b_evidence/MANIFEST.md>" --gate3 "<lynn evidence>"` — **БЕЗ** `--id-prefix`: штампует все файлы в `--dir`, 140 КВ флипаются, 49 ИдО idempotent-skip (если уже verified). Убедись, что ИдО прошли свой 2a/3 — см. `GATE2A_IDO_FINDINGS.md` + `HANDOFF_IDO_S1_BACKFILL.md`.
   *(Префикс-фильтр `--id-prefix` добавлен в `mark_verified.py` в рамках ИдО-выхода — TASK B из `HANDOFF_IDO_S1_BACKFILL.md`. ЭРРАТУМ: для КВ `--id-prefix kv.` ОШИБОЧЕН — резолвится в `kv.mechanics.kv.` = 0 eligible; КВ штампуется БЕЗ фильтра.)*

## /goal (готов к вставке — Claude Code, auto mode, accept trust dialog)
```
/goal Apply gate-2a KV-core fixes, scripts-only, per docs/HANDOFF_KV_GATE2A_FIXES.md.
(F1) In build_mechanics_b7.py set eye.bditelnost_oka growth.eyes_gaze.trigger to "eye_on_feat_die out_of_combat"
and rewrite its notes to the no-scan Eye-resolution wording (do NOT touch source_text or summary).
(F2) In build_mechanics_b6.py set shadow.bally_teni miserable_effect to "eye_on_feat_die = auto_failure".
(F3) In build_mechanics_pilot.py add related ["kv.mechanics.checks.assistance"] to checks.who_rolls, and related
["kv.mechanics.traits.navyki","kv.mechanics.traits.boevye_umeniya","kv.mechanics.valour_wisdom.doblest",
"kv.mechanics.valour_wisdom.mudrost"] to checks.which_ability; leave checks.retry empty.
(J5 optional) In build_mechanics_b5.py lowercase "Фаза"->"фаза" in vyhod_iz_boya section.
Then regenerate by running those build scripts. DONE when, in the transcript: validate.py prints OK 222;
independent_check.py prints failures: 0; check_param_numbers.py prints no duplicates; check_determinism.py prints
byte-identical; and the re-confirm snippet from the handoff prints "PASS F1+F2+F3 ok". CONSTRAINTS: never edit the
49 solo.* ИдО cards or any existing KV edge except the F3 additions; never hand-edit JSON (only via scripts);
ASCII commit, -m only. STOP and ask if any target id does not resolve. Stop after 25 turns.
```

---
*Самооценка ревьюера по этому хэндоффу: эдит-сайты выверены по строкам реальных скриптов; целевые значения зеркалят уже-зелёный `conditions.miserable` (F2) и существующий вокабуляр (F1); все 5 F3-целей подтверждены. Слабое место: точная финальная формулировка `trigger`/`notes` (F1) — авторское усмотрение, рекомендованное значение приведено; J5 направление регистра — выбрал «привести один выброс к большинству» (8/9 строчные), но автор может нормализовать в любую сторону, лишь бы внутри кластера консистентно.*
