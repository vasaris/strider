TASK: lynn-review — сессия 2 этапа 0: 8 JSON lifepaths + 3 схемы + расширение common/гейтов
MODE: REVIEW ONLY. PASS/FAIL по пунктам с file:line. Не менять, не чинить, не мержить.

READ FIRST: docs/lynn_review_brief_stage0_session1.md (правила те же), ADR-001,
vision_sweep_report_lifepaths.json (если приложен).

CHECKLIST:
1. SCOPE: +8 JSON в kv/lifepaths/, +3 схемы, расширения common.schema.json;
   25 файлов kv/tables/solo/ НЕ изменились содержательно (verified-блоки сессии 1 целы).
2. CORRECTNESS: события — Око первая/руна последняя по скану стр. 10–11; знаки
   эффектов (затворник = братство −1, весельчак = +1; слабый = Выносливость −2,
   Парирование +1; сильный — зеркально; счастливчик = образ жизни +1, опыт −5);
   кросс-реф культур cultures ↔ 6 файлов предысторий; «1 за 11» хранится дословно
   с engine_note о неоднозначности, БЕЗ интерпретации в effects сверх буквы текста.
3. CIRCULARITY: независимая сверка ячеек с текстовым слоем СВОИМ кодом + 10+ ячеек
   по сканам напрямую (включая числа характеристик двух культур).
4. NO-DRIFT: схемы сессии 1 расширены, не сломаны (solo-файлы валидны без правок);
   новые op перечислены в common и все использованы по фактам книги.
5. GATES: validate.py → «OK: 33 files»; independent_check.py → 473/473;
   пересборка build_lifepath_tables.py байт-детерминирована.
6. DOCS: PROVENANCE для слоя ЖП; брифы сессии 2 согласованы с ADR-001.
OUTPUT: PASS/FAIL; non-blocking → known_issues с severity. verified не трогать.
