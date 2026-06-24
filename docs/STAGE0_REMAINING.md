# STAGE 0 — оставшийся план до выхода (живой чек-лист)

Назначение: оркестрация между сессиями. **Это НЕ ревью-бриф** — gate-3/gate-2a сессии работают по своим брифам (`HANDOFF_IDO_GATE3_LYNN.md` и т.д.), а не по этому файлу.
Критерий выхода Stage 0 (arch §9): «**Пак kv с `verified` контентом**» — практически: все 189 rule_cards `verified:true` (33 таблицы уже verified, Sessions 1/2).
ADR-001: author ≠ reviewer. gate-2a и gate-3 — всегда **свежие НЕ-авторские** сессии; правки и подготовка карт — авторские.

Состояние на HEAD `e1c1845`. Авто-гейты зелёные: `validate` 222 · `independent_check` 676/0 · `check_determinism` byte-identical · `check_param_numbers solo.` 49/0 · `confirm_s1_edges` PASS 14/14 + Q2 ok.

---

## Уже сделано
- ✅ **Таблицы (33)**: 25 solo + 8 lifepaths — `verified:true` (Sessions 1/2).
- ✅ **gate-1** (авто) — для всех 189 карт: `source_text` дословен, детерминизм, числа трассируются, нет висячих `related`.
- ✅ **ИдО gate-2a** — закрыт (`GATE2A_IDO_FINDINGS.md` @ `647fd6b`: 49/49 SUPPORTED; единственный gap S1 устранён).
- ✅ **ИдО S1 back-fill + тулинг** — `522d4cb` (рёбра), `59276f7` (`--id-prefix`), `f7f431d` (docstring + регресс-гейт), `e1c1845` (F-док-1 + arch-док в репо).
- ✅ **ИдО gate-2b** — `verify_2b_ido` 5/5 (прозовые числовые цели по сканам).
- ✅ **КВ gate-2b** — `gate2b_evidence/MANIFEST.md`: «осталось пусто, 0 расхождений» по сканам реального PDF (ADR-002, vision-spotcheck чисел).

---

## ТРЕК ИдО (49 карт) — один шаг до готовности

- [ ] **Шаг 1 · gate-3 lynn-review ИдО** — свежая НЕ-авторская сессия. Бриф: `docs/HANDOFF_IDO_GATE3_LYNN.md`. REVIEW-ONLY, PASS/FAIL + file:line, `verified` не трогать. Выход: вердикт + находки.
- [ ] **Шаг 2 · простановка ИдО** (только после PASS шага 1; автор/Иван):
  ```
  python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics --id-prefix solo. \
    --gate2 "<2a: GATE2A_IDO_FINDINGS.md @647fd6b + S1 backfill; 2b: verify_2b_ido 5/5>" \
    --gate3 "<lynn-review PASS evidence>"
  ```
  `--id-prefix solo.` штампует **только 49** (КВ-140 пропускаются: `eligible 49 / skipped 140`). После этого ИдО полностью закрыт.

---

## ТРЕК КВ-ядро (140 карт) — основная масса оставшегося Stage 0

- [ ] **Шаг 3 · автор: построить ревью-карту КВ** — свежая авторская сессия готовит `docs/HANDOFF_KV_REVIEW.md` (аналог `HANDOFF_IDO_REVIEW.md`: карта 140 карт по кластерам, judgment-calls, §-структура). **Сейчас её НЕТ** — обязательный задел (у ИдО такая карта была — это давало фору).
- [ ] **Шаг 4 · gate-2a КВ** — свежая reviewer-сессия по карте шага 3 → SUPPORTED/PARTIAL/UNSUPPORTED + findings (как `GATE2A_IDO_FINDINGS.md`). *(gate-2b для КВ уже ✅.)*
- [ ] **Шаг 5 · автор: применить 2a-правки КВ** (если есть) → регенерация → гейты зелёные.
- [ ] **Шаг 6 · gate-3 lynn-review КВ** — свежая НЕ-авторская сессия.
- [ ] **Шаг 7 · простановка КВ** (автор/Иван):
  ```
  python3 tools/extraction/mark_verified.py --dir content-packs/kv/mechanics \
    --gate2 "<КВ 2a+2b evidence>" --gate3 "<КВ lynn PASS>"
  ```
  Без `--id-prefix` → флипнет оставшиеся 140; 49 ИдО уже `verified` → idempotent-skip их пропустит.

---

## Полнота пака против arch pack-layout (после верификации всех 189) — нужны решения по скоупу

- [ ] **Шаг 8 · `manifest.json`** — построить (система, версия, зависимости, verified-статус). Интерфейс загрузки для движка; нужен к Stage 1. (Естественный артефакт на стыке Stage 0 → 1.)
- [ ] **Шаг 9 · РЕШЕНИЕ: `lore/` + `tone.md`** — явно решить Stage 0 vs Stage 2.
  - `lore/` — RAG-чанки (Эриадор, регионы, покровители), arch §3.2.
  - `tone.md` — тоновый контракт (регистр, стоп-лист пака, голоса культур).
  - Функционально оба нужны Stage 2 (нарратив/RAG); в roadmap-выходе Stage 0 явно не перечислены, но в pack-layout присутствуют. → решение за Иваном.
- [ ] (мелочь, не блокер) adversaries живут как 7 карт в `mechanics/`, а не отдельным `adversaries/` — оставить так или вынести.

---

## Выход
После **шага 7** (все 189 карт verified) + шага 8, и по решению шага 9 — **Stage 0 закрыт**, переход к Stage 1 (движок; критерий — CLI-прохождение путешествия без LLM).

Порядок (рекомендация): добить ИдО (шаги 1–2) → КВ-ядро (3–7) → `manifest.json` (8) → решить lore/tone (9). Треки ИдО и КВ независимы и в принципе параллелятся в разных чатах.
