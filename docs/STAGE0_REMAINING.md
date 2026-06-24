# STAGE 0 — оставшийся план до выхода (живой чек-лист)

Назначение: оркестрация между сессиями. **Это НЕ ревью-бриф** — gate-3/gate-2a сессии работают по своим брифам (`HANDOFF_IDO_GATE3_LYNN.md` и т.д.), а не по этому файлу.
Критерий выхода Stage 0 (arch §9): «**Пак kv с `verified` контентом**» — практически: все 189 rule_cards `verified:true` (33 таблицы уже verified, Sessions 1/2).
ADR-001: author ≠ reviewer. gate-2a и gate-3 — всегда **свежие НЕ-авторские** сессии; правки и подготовка карт — авторские.

**Stage 0 ЗАКРЫТ** (КВ-стэмп `eabd9d1`, манифест `5e46b16`). Все 222 файла `verified:true` (140 КВ-ядро + 49 ИдО + 25 solo + 8 lifepaths). Гейты зелёные: `validate` 222 (+ манифест по схеме) · `independent_check` 676/0 · `check_param_numbers` ok · `check_determinism` byte-identical · `build_manifest --check` 222/222 all_verified=true · `confirm_kv_gate2a_fixes` PASS · `verify_gate2b_training_cost` PASS.

---

## Уже сделано
- ✅ **Таблицы (33)**: 25 solo + 8 lifepaths — `verified:true` (Sessions 1/2).
- ✅ **gate-1** (авто) — для всех 189 карт: `source_text` дословен, детерминизм, числа трассируются, нет висячих `related`.
- ✅ **ИдО gate-2a** — закрыт (`GATE2A_IDO_FINDINGS.md` @ `647fd6b`: 49/49 SUPPORTED; единственный gap S1 устранён).
- ✅ **ИдО S1 back-fill + тулинг** — `522d4cb` (рёбра), `59276f7` (`--id-prefix`), `f7f431d` (docstring + регресс-гейт), `e1c1845` (F-док-1 + arch-док в репо).
- ✅ **ИдО gate-2b** — `verify_2b_ido` 5/5 (прозовые числовые цели по сканам).
- ✅ **КВ gate-2b** — `gate2b_evidence/MANIFEST.md`: «осталось пусто, 0 расхождений» по сканам реального PDF (ADR-002, vision-spotcheck чисел).

---

## ТРЕК ИдО (49 карт) — ✅ ЗАКРЫТ

- [x] **Шаг 1 · gate-3 lynn-review ИдО** — пройден (свежая НЕ-авторская сессия по `HANDOFF_IDO_GATE3_LYNN.md`).
- [x] **Шаг 2 · простановка ИдО** — выполнено: 49 карт `verified:true` (подтверждено idempotent-skip при КВ-стэмпе: `already verified: 49`).

---

## ТРЕК КВ-ядро (140 карт) — ✅ ЗАКРЫТ

- [x] **Шаг 3 · ревью-карта КВ** — `docs/HANDOFF_KV_REVIEW.md` (карта 140 карт по кластерам, §6 + Appendix A, judgment-calls).
- [x] **Шаг 4 · gate-2a КВ** — `GATE2A_KV_FINDINGS.md` (+ re-confirm `GATE2A_KV_RECONFIRM.md`): F1–F4/J1–J5.
- [x] **Шаг 5 · 2a-правки КВ** — применены (F1/F2/F3 @`636171d`, F4 @`0becd6b`), регенерация, гейты зелёные.
- [x] **Шаг 6 · gate-3 lynn-review КВ** — PASS (свежая НЕ-авторская сессия, 2026-06-24): 6 гейтов зелёные, рун-канон не инвертирован, граф 342 рёбер сошёлся с картой, J1–J7 закрыты, 3 INFO non-blocking.
- [x] **Шаг 7 · простановка КВ** — `eabd9d1`: `verified flipped: 140, already verified: 49`. Все 189 карт `verified`.

---

## Полнота пака против arch pack-layout — ✅ решено

- [x] **Шаг 8 · `manifest.json`** — построен (`5e46b16`). Деривируемый интерфейс загрузки: `system`/`pack_version`/`sources`/`schemas`/`content`/`dependencies`/`verified`. Сборка `build_manifest.py` (детерминирована; `--check` = байт-идентичная пересборка-гейт); `validate.py` валидирует форму по `manifest.schema.json`. 222 файла, all_verified=true.
- [x] **Шаг 9 · РЕШЕНИЕ: `lore/` + `tone.md`** → **отложены в Stage 2** (см. `ADR-003-lore-tone-stage2.md`). Оба — нарративный/RAG-слой, потребитель Stage 2; под verified-дисциплину сейчас наполнить нечем без сочинения мимо гейтов. Манифест расширяется бампом без поломки интерфейса. Долг вынесен в Stage 2 явным пунктом.
- [x] (мелочь) adversaries — **оставлены** как 7 `rule_card` в `mechanics/` (gate-3 J4); вынос в отдельный `adversaries/` = рефактор Stage 1, не Stage 0.

---

## Выход — ✅ ДОСТИГНУТ
Шаги 7 (189 verified) + 8 (manifest) выполнены, шаг 9 решён (ADR-003). **Stage 0 закрыт.**
Переход к **Stage 1** (движок; критерий выхода — CLI-прохождение путешествия без LLM):
TypeScript strict, чистые функции `(state, action, rng) → (result, statePatch)`,
юнит-тесты на сидированном RNG (распределения таблиц, формулы ЦЧ, рост Ока),
загрузка пака через `manifest.json`, отказ грузить неверифицированное в проде.
