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

## Engine follow-on (DONE -- ranged-attack-buff task wired)

The buff hook was wired into the combat round. A successful task whose effect
feeds the next ranged attack now grants bonus dice, consumed by the next
ranged-stance hero attack via the existing `extraSuccessDice` seam:

1. Config (`combat/config.ts`, `fromPack.ts`): `deriveCombatConfig` takes the
   solo `prodvinutsya` card and merges its task into the task map alongside the
   four core tasks (core/solo cards stay separate). `deriveTask` learns
   `check_any` (a choice of skills; falls back to `check`). `CombatTaskKey` gains
   `prodvinutsya`.
2. Round (`combat/round.ts`): on a successful task whose `effect.onSuccess`
   contains `next_ranged_attack`, grant `plusDice(onSuccess) + signs *
   plusDice(perSign)` (numbers parsed from the `plus_Nd` descriptors, nothing
   baked) into `heroFrame.pendingRangedBonusDice`. The next ranged-stance hero
   attack injects it as `extraSuccessDice` and clears it. The `hero_task` event
   now reports `buffApplied: boolean` + `grantedDice`. The trigger is the EFFECT
   descriptor, not the task key, so the core `prepare_shot` twin lights up too.
3. State: `HeroCombatFrame.pendingRangedBonusDice` persists across the round
   boundary until consumed (startRound does not reset it).

Tests: `combat/config.test.ts` (anti-hardcode stub with `plus_2d` + `check_any`);
`combat/round.test.ts` (grant = 1 + signs, per-sign scaling, prepare_shot
effect-driven, invalid check rejected, ranged consumes/non-ranged preserves, and
a hit-rate property test proving the dice feed the attack). Golden `ork-2`
unchanged (it uses no tasks).

## Still deferred

The manoeuvre MODE (`manevrennaya_poziciya_dalniy_boy`): ranged-only attacks,
enemy-melee `-1d`, hero-ranged `-1d`, the no-penalty ranged leave-combat, and the
"bonus dice to leave combat" use of the buff. This is a combat-frame mode wider
than the melee-round loop -- its own beat if/when solo ranged combat is wired.
