# HANDOFF: Progression -> Fellowship Phase (Stage 1)

Self-contained reference for the session after Progression. Read this in full
before writing any code. Numbers come from the verified pack, not from here.

## Where we are

Stage 1 "extended" is being driven to completion. The Progression subsystem (the
deterministic growth core) is delivered and green. The remaining Stage-1 work is
the **Fellowship Phase** wrapper, which closes Stage 1.

Baseline at delivery:
- `engine` typecheck clean; `npm test` = **331 passed (40 files)**.
- Cyrillic scan over `src` = CLEAN.
- Golden CLIs: journey `dark-1` -> durationDays 8; combat `ork-2` -> hero_won;
  council `council-m10` -> goal_achieved; progression `progression-1` ->
  vengeance / flawsGained 1.

## Explicit decision on roadmap (overrides the architecture doc)

`brodyazhnik-architecture-v1.md` Sec 9 places the Fellowship Phase in Stage 4 and
scopes Stage 1 to checks/oracles/Eye/journey. Ivan explicitly decided
(not silently) to run an **extended Stage 1 to the end**: the Fellowship Phase
closes Stage 1. Combat, Council and Progression were all built under this
decision. Treat the Fellowship Phase as the Stage-1 closer.

## Grant model decision (Rewards / Virtues) -- locked

Single source of truth, no baked deltas:
- A valour level-up grants a **Reward** (nagrady.gain_per = "valour_level"); a
  wisdom level-up grants a **Virtue** (osobennosti.gain_per = "wisdom_level").
- The chosen key is the player's input; the engine validates it against the pack
  taxonomy and **records the opaque key** on `HeroState.rewards` /
  `HeroState.virtues`. It does NOT bake numeric deltas (parry, hope_max, etc.).
- Effects are applied at point of use by each consumer, read from the pack card:
  - Virtues that feed combat (nimbleness/parry, strong_grip, ...) and checks
    (prowess/characteristic_tn) are read by those subsystems from the virtue list.
  - Virtues that raise hero caps (confidence -> hope_max, hardiness ->
    endurance_max) are derived, not stored as new base numbers.
  - **Rewards are equipment-bound**: the mechanical effect is applied in Stage 4
    when the gear/treasure economy exists. Progression only records the key.
- Cultural Virtues (osobennosti_<culture>) are allowed in place of a regular
  Virtue when the hero's culture matches and wisdom >= culturalMinWisdomLevel (2).

Rationale: one authoritative record (the acquired keys), every consumer derives
consistently (no double-counting), reversible, and faithful to the book (the
effect text lives in the cards, applied where it bites).

## Subsystem boundary (so the Fellowship Phase knows its lane)

- **Progression (delivered, this module, RNG-free):** the growth primitives.
  - `earnExperience(hero, milestoneIndices, cfg)` -- solo milestone awards
    (kv.solo.milestones; per-milestone, NOT "3 per session"). Indices are ASCII;
    the Cyrillic milestone labels stay opaque pack values on
    `hero.milestonesReached`.
  - `spendExperience(hero, plan, cfg)` -- cost table (folio 119), per-phase caps
    (1 level/skill, 1 level/weapon-skill, one of valour-or-wisdom), which pool
    pays, and the Reward/Virtue grant. Fail-fast; never partial.
  - `applyShadowPathAdvance(hero, cfg)` -- one Shadow-Path step per bout of
    madness; 4th Flaw => succumbed.
  - `runProgression(hero, input, cfg)` -- earn -> spend -> shadow steps.
- **Fellowship Phase (next, the Stage-1 closer):** the wrapper. Duration / place /
  number of undertakings; the **spiritual recovery** step (Hope restore =
  heart_rating; Yule = full restore; Shadow-point removal 1/2/3 -- solo via
  `kv.solo.shadow_recovery`, marked phase:fellowship); and the improve-stats
  undertaking, which calls `runProgression` (or `spendExperience` directly). The
  Fellowship Phase OWNS the cost table card
  (`fellowship_phase.struktura_fazy_bratstva`); Progression already reads the
  improve_stats block from it.
- **Stage 4 (later):** equipment/treasure economy, application of Reward effects
  to gear, and solo creation (`kv.solo.predydushchiy_opyt` -> hero_adjustments,
  15 points).

## Hooks already in place

- `conditions/shadow.ts` `boutOfMadness()` returns `{ hero, advancesShadowPath:
  true }` -- that flag is the trigger for `applyShadowPathAdvance`. `braceSpirit`
  resets points and adds a scar but does NOT step the path (no Flaw).
- `HeroState` carries additive optional progression fields (experience, valour,
  wisdom, weaponSkills, virtues, rewards, calling, culture, shadowPath, flaws,
  milestonesReached). Journey/combat/council do not read them.

## Content gap to fix at the pack gate (NOT in code)

The **messenger** calling card carries `shadow_path: "wandering_madness"`, while
the Shadow-Path owner (`shadow.ispolzovanie_izyanov`) lists the path key
`"wandering"`. The engine refuses to alias this: a messenger hitting a bout of
madness throws "path ... not found in the Shadow-Path card". Fix the card at a
content gate so the two agree, then the throw disappears. A test in
`test/progression/shadowPath.test.ts` pins this mismatch so the fix is visible.

## Deferred (unchanged)

- Sec 3.7 solo-overlay combat-task buff distribution: empty cards; needs a
  content gate before the engine can interpret it.

## Public API delivered by Progression

`progressionConfigFromPack`, `runProgression`, `earnExperience`,
`spendExperience`, `applyShadowPathAdvance`, the `deriveX` config seams, and the
types (`ProgressionConfig`, `ProgressionInput`, `ProgressionResult`, `SpendItem`,
`SpendPlan`, `GrantEvent`, `ShadowStepResult`, ...). All exported from
`progression/index.js` and the root barrel.
