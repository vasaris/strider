# HANDOFF: Solo maneuver position / Prodvinutsya (Sec 3.7)

Content side done; engine consumption is the follow-on. Read before the combat
patch. Numbers come from the verified pack, not from here.

## What changed (content only, this pass)

Three IdO p.17 solo cards had verified source_text but empty `parameters: {}`.
Their structured parameters are now authored from that verified text (source_text
unchanged; schema mirrors `combat.boevye_zadachi.tasks.*` so the existing combat
reader extends cleanly):

- `kv.mechanics.solo.prodvinutsya` -- the combat task. `tasks.prodvinutsya`:
  stance `ranged`, `action` main_action, `check_any: ["athletics","search"]`
  (the only task with a choice of check), effect `plus_1d_next_ranged_attack` +
  `per_sign: plus_1d`, `bonus_dice_usable_for: ["ranged_attack","leave_combat"]`,
  `maneuver_mode` link.
- `kv.mechanics.solo.manevrennaya_poziciya_dalniy_boy` -- the maneuver MODE (not a
  task): `hero_attacks: ranged_only`, enemy attack modifier melee `minus_1d` /
  ranged `none`, hero ranged attack `minus_1d`, `leave_combat` via a ranged-attack
  check with `penalty: none` (success -> leave without damage, failure -> stay),
  `available_tasks: ["prodvinutsya"]`.
- `kv.mechanics.solo.manevrennaya_poziciya` -- the parent: `pre_melee_volleys:
  scene_determined` (ref `combat.nachalo_boya`; the count is a scene condition set
  by the Keeper, p.96, not a fixed table), `enables_mode` link.

Gates run: `validate.py` 222 OK; `check_param_numbers.py` OK (no untraceable
numbers -- the "+1d/-1d" live as descriptors, like core tasks). The three cards
keep `verified: true` (text_fidelity untouched); a reviewer re-confirm (vision
sweep p.17 + check_param_numbers on these ids) formally closes the new params.

## Engine follow-on (NOT done -- separate combat patch, re-opens Stage-1 combat)

The buff hook already exists: `combat/round.ts` carries `buffApplied: false` and
the `extraSuccessDice` injection seam; `combat/config.ts` reads tasks from
`combat.boevye_zadachi`. The patch:

1. Config: also read `kv.mechanics.solo.prodvinutsya` `tasks` and merge/register
   it alongside the core tasks (it is a ranged-stance task like `prepare_shot`).
   Teach the task reader the `check_any` field (fall back to `check` when absent),
   so a task may offer a choice of skills. Keep solo and core cards separate
   (overlay principle) -- read both, do not move the task into the core card.
2. Round: when the chosen task is `prodvinutsya`, on a successful check inject
   `extraSuccessDice = 1 + signs` into the NEXT ranged attack (or the leave-combat
   check), and flip `buffApplied: true`. The "+1 per sign" is already the
   `per_sign: plus_1d` descriptor.
3. (Optional, larger) the maneuver MODE (`manevrennaya_poziciya_dalniy_boy`):
   ranged-only attacks, enemy-melee `-1d`, hero-ranged `-1d`, leave-combat via a
   no-penalty ranged check. This is a combat-frame mode, wider than the current
   melee-round loop -- scope as its own beat if/when solo ranged combat is wired.

Tests for the follow-on: anti-hardcode on a stub `prodvinutsya` task with
different dice; `+1 per sign` distribution on seeded RNG; a parse test that the
same reader handles both `check` (core) and `check_any` (solo).

## Still deferred (unchanged)

None from Sec 3.7 on the content side. The engine consumption above is the only
open item for this feature.
