# kv-pending/lt1 — staging для LT1 (tone.md + lore)

**Зачем эта область.** `loadPack` отказывается грузить пак, если хоть один JSON не
`verified:true` ([loadPack.ts:43-66](../../../engine/src/pack/loadPack.ts)), а
`build_manifest` сканирует только `CONTENT_DIRS`. Значит драфты с `verified:false`,
положенные в живой `content-packs/kv/`, **уронили бы загрузку пака и все тесты**.
Поэтому драфты живут ЗДЕСЬ — сиблинг `kv/`, вне обоих сканеров. Зеркало Stage-0
дисциплины: **draft → гейт → verify → перенос в живой пак**.

CCD драфтит → **Иван верифицирует** → только потом в живой пак. `verified:true`
ставит Иван, не CCD.

## Что лежит (всё `verified:false`, драфты)
- `tone/tone.md` — тоновый контракт (регистр, голоса культур, стоп-лист). Проза;
  гейт = человеческий ревью (`docs/LT1_TONE_REVIEW.md` + frontmatter), не машинный.
- `tone/tone.stoplist.json` — машинный стоп-лист ВК-пастиша (→ `VK_ADDENDUM`).
- `lore/lore.*.json` — 5 RAG-шаблонов (golden-регионы border/wild/dark + патроны
  gandalf/cirdan). Текст — ПЛЕЙСХОЛДЕР: пересказ из книг TOR2e, не дословно, не из
  легендариума, сверка против книг Ивана.

## Машинерия (уже в репо, активируется при переносе)
- Схемы: `content-packs/schemas/lore_chunk.schema.json`, `tone_stoplist.schema.json`.
- Гейт-скаффолд: `evals/src/lt1gate.ts` (анти-слоп + бюджет 300–600 ток. через
  char-прокси; VK_ADDENDUM-лоадер; догфуд tone-примеров) + тесты `evals/test/lt1gate.test.ts`.
- Манифест: `build_manifest.py` знает `lore/` (skip пока пусто) и **механически**
  штампует `pack_version` 0.2.0, как только в `kv/lore/` появится verified-контент.

## Бюджет — без числа в данных
`lore_chunk` НЕ хранит `token_estimate`/`char_count` (дрейфует по токенайзеру). Бюджет
300–600 ток. считает гейт из текста (char-прокси, `CHARS_PER_TOKEN` калибруется в 2.3).

## Активация (Иван, после верификации)
1. **Lore:** в каждом чанке заменить плейсхолдер оригинальной прозой из книги (300–600
   ток.), проставить `source.edition`/`pages`, прогнать `gateLoreChunkText` (block-clean
   + бюджет), затем `verified:true`.
2. **tone.stoplist.json:** выверить термины, `verified:true`.
3. **tone.md:** записать ревью в `docs/LT1_TONE_REVIEW.md` (`reviewed_by`/дата/вердикт),
   догфуд примеров (`gateToneExamples`) — чисто, выставить `verified:true` во frontmatter.
4. **Перенос:** `lore/*.json` → `content-packs/kv/lore/`; `tone.md` + `tone.stoplist.json`
   → `content-packs/kv/` (сайдкары, не в `content[]`).
5. **Ребилд:** `python3 tools/extraction/build_manifest.py` → авто `0.2.0`; затем
   `--check` зелёный; `cd engine && npm test` зелёный (пак грузится).
6. **Подключить** `VK_ADDENDUM`: evals/orchestrator грузят `content-packs/kv/tone.stoplist.json`
   по пути; заполнить слоты `prompts/keeper.system.v0.md` из `tone.md` (чат 2.3).
