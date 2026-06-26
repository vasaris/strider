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

## Engine follow-on 2 (DONE -- manoeuvre MODE wired)

The manoeuvre position (`manevrennaya_poziciya_dalniy_boy`) is now a combat-frame
mode. All dice numbers come from the card descriptors (`minus_1d` -> 1); nothing
baked.

1. State/config: `CombatState.maneuverPosition?: boolean` (whole-fight flag; off
   when absent -- golden `ork-2` is unaffected). `EnemyWeapon.range?:
   "melee"|"ranged"` (absent = melee), read by `deriveWeapon`. New
   `ManeuverModeConfig` on `CombatConfig.maneuver`, derived by `deriveManeuver`
   from the card (`enemyMeleeMinus`, `heroRangedMinus`, `exitCheck`,
   `exitNoPenalty`); `deriveCombatConfig` gains a 6th param, `fromPack` passes the
   card. The deriver asserts the card's enemy `ranged` modifier is `none`.
2. Round (`combat/round.ts`): in manoeuvre position a melee enemy attack takes
   `-enemyMeleeMinus` (ranged enemy weapons untouched); the hero may attack only
   from the ranged stance (else it throws), and the hero's ranged attack takes
   `-heroRangedMinus`, which STACKS with any pending Advance buff (both flow
   through `extraSuccessDice`; net may be negative -> penalty dice).
3. Exit (`combat/exit.ts`): new `maneuver` exit method -- a ranged-attack check
   WITHOUT the manoeuvre penalty ("ne ubiraya 1k"); on success the hero leaves
   dealing no damage. Any pending Advance bonus dice are spent on the attempt
   (cleared whether it lands or not). Requires the ranged stance.

Tests: `combat/config.test.ts` (manoeuvre stub with `minus_2d` proves
pack-sourcing); `combat/round.test.ts` (+6: enemy melee debuff statistical,
ranged enemy exact-equal on/off, ranged-only throw, hero penalty + buff-stack
statistical, manoeuvre exit consumes pending + no damage, exit requires ranged
stance). Suite 383 -> 389. Goldens unchanged.

## Still deferred (non-blocking)

- The mode is a whole-fight flag (M1a); no mid-fight enter/leave action exists
  (the book frames it as the nature of the engagement, not a turn action).
- `pre_melee_volleys` stays scene-determined (distance-driven, no fixed table in
  the pack).
- Independent reviewer re-confirm of the four content cards touched this session
  (messenger + 3 Sec 3.7) remains author-external.
