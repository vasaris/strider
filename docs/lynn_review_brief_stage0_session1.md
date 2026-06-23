TASK: lynn-review — пак kv/tables/solo (этап 0, сессия 1): 25 JSON-таблиц «Игры для одного» + 9 схем
MODE: REVIEW ONLY. Do NOT modify, do NOT commit, do NOT fix. Output PASS/FAIL per
      checklist item with file:line evidence. If something is wrong, report it — do not repair it.

UNDER REVIEW: содержимое brodyazhnik-stage0-session1.zip (ветки нет — добрепозиторный этап;
дельта = всё дерево). Источник правды: книги в project knowledge + brodyazhnik-architecture-v1.md §3.

READ FIRST (verify against the real tree and the BOOK SCANS, not the build session's report):
- brodyazhnik-architecture-v1.md §3 (контент-пайплайн), §9 (этап 0)
- VERIFICATION_REPORT.md и KNOWN_ISSUES.md — как карта, НЕ как истина
- content-packs/schemas/common.schema.json (маппинг рун)

CHECKLIST (each → PASS/FAIL + evidence):

1. SCOPE: ровно 25 JSON в content-packs/kv/tables/solo/, 9 схем, ноль контента ВК вне content-packs/.

2. CORRECTNESS — куда зелёный валидатор не дотягивается:
   - Руны: Око=11, руна Гэндальфа=12 (КВ, «выполнение проверок») — НЕ инвертировано
     в common.schema.json и нигде в payload не закодировано числом.
   - Позиции рун: для каждой feat-таблицы строка/секция Ока и руны соответствует СКАНУ
     (стр. 10/13/16/19/23/26/28), а не только позиционной конвенции.
   - Знаки эффектов: luck/eye = −1 Око; misfortune/eye = +2; short_cut = −1 день;
     mishap = +1 день; пороги ответов 1/4/6/8/10; пороги преследования 18/16/14.
   - 6 покровителей × 6 заданий; предания 12 секций × 6 строк × 3 колонки.

3. CIRCULARITY: независимый чекер (/tmp или свой) сверяет ячейки JSON с текстовым слоем
   ДРУГИМ кодом, не parsers.py; выборочно 10+ ячеек — со сканами напрямую.

4. NO-DRIFT: payload-структуры соответствуют схемам, утверждённым в чате такта 1;
   все расширения (fatigue_waived, skills_pool) перечислены и санкционированы Иваном.

5. GATES: python3 tools/extraction/validate.py → «OK: 25 files»; повторная сборка
   build_solo_tables.py даёт байт-идентичные JSON (детерминизм).

6. DOCS: VERIFICATION_REPORT.md и DUPLICATE_DIFFS.md соответствуют дереву и сканам;
   ложных утверждений нет (известное: F2 в KNOWN_ISSUES.md — проверить, исправлено ли).

OUTPUT: Verdict PASS/FAIL; per item; blockers exact. Non-blocking → known_issues с severity.
Do NOT merge / do NOT flip verified — only Ivan does.
