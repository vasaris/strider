# UI labels — ревью-рекорд `ui_labels.json`

> Сайдкар `content-packs/kv/ui_labels.json` (чат 3.2): русские имена id, у которых в паке нет
> структурного имени (пак называет их только в тексте правил). Машинный гейт: у каждой записи
> evidence — дословная подстрока `title` или `payload.source_text` verified-карты `source_card`;
> проверяется тестом (`app/test/service/uiLabels.test.ts`) и при каждой сборке каталога подписей
> (`app/src/server/service/labels.ts`). Человеческий гейт — этот рекорд (как `LT1_TONE_REVIEW.md`).
> Новые записи — только с evidence и sign-off Ивана; без evidence id показывается как есть.

## Sign-off (чат 3.2: K5.1 + K5.2)

- reviewer: Ivan — блоки ревьюера «K5.1» и «K5.2», пересланные Иваном (пересылка = подтверждение)
- date: 2026-10-04
- verdict: ACCEPTED → `verified: true`
- K5.1, 10 записей:
  - `region`: `border_lands`, `wild_lands`, `dark_lands`;
  - `outcome`: `failure`;
  - `condition`: `dying`;
  - `tracker`: `fatigue`, `eye`, `endurance`, `hope`, `shadow`.
- K5.2, 3 записи:
  - `roll`: `favoured`, `ill_favoured`;
  - `role`: `keeper`.
- evidence: каждая строка сверена с картой байт-в-байт до записи и повторно — независимыми
  верификаторами K5.1 и K5.2
- scope: `pack_version` не бампался (сайдкар вне `manifest.content[]`); коммиты `f170450` (K5.1),
  `51777dd` (K5.2); ссылка — `docs/ROADMAP_SESSIONS.md`, чат 3.2
