# HANDOFF: Fellowship Phase -> Stage 1 COMPLETE

Self-contained reference for the session after the Fellowship Phase. Read this in
full before any further code. Numbers come from the verified pack, not from here.

## Where we are

The **Fellowship Phase** is delivered and green. It is the Stage-1 closer under
the explicit "extended Stage 1 to the end" decision (see HANDOFF_PROGRESSION.md).
With it, **Stage 1 (extended) is COMPLETE**: dice/RNG, Eye, checks, journey,
conditions/Shadow, hero state, combat, council, progression, and now the
Fellowship Phase wrapper.

Baseline at delivery:
- `engine` typecheck clean; `npm test` = **375 passed (46 files)** (was 331/40).
- Cyrillic scan over `src` = CLEAN.
- Golden CLIs (all stable):
  - journey `dark-1` -> durationDays 8
  - combat `ork-2` -> hero_won
  - council `council-m10` -> goal_achieved
  - progression `progression-1` -> vengeance / flawsGained 1
  - fellowship `fellowship-yule-1` -> Yule, Hope 3/3, shadowRemoved 2, valour 2,
    reward "fell", pools {adv 0, skill 3}

## What the Fellowship Phase is (and is not)

It is the **wrapper** that sequences one between-adventures phase, RNG-free (like
progression -- it rolls no dice). It does NOT re-implement growth: the
improve-stats step delegates to the already built `runProgression`.

Module `engine/src/fellowship/`:
- `config.ts` `fellowshipConfigFromPack(pack)` -- reads four cards via pure
  `deriveX` seams (anti-hardcode): `struktura_fazy_bratstva` (steps, duration
  descriptors, place tags, spiritual-recovery tiers), `kv.solo.shadow_recovery`
  (solo removal amounts, cross-checked), `yol` (full hope, aging, wits bonus
  skill), `nachinaniya_fazy_bratstva` (undertaking budget + catalog).
- `recovery.ts` `applySpiritualRecovery` -- Hope += HEART rating (Yule = full);
  Shadow points -= chosen tier amount, floored at 0. HEART read off the hero.
- `yule.ts` `applyYule` -- credits bonus skill points = WITS rating; returns
  `agedYears` (HeroState has no age field yet -> recorded, not stored).
- `undertakings.ts` `validateUndertakings` -- budget from the card (normal: 1
  common + 1 calling-free; Yule: per-hero + common), Yule-only undertakings
  rejected outside Yule, distinctness except yule-tagged. Records keys only.
- `runFellowship.ts` `runFellowship(hero, input, cfg, progressionCfg)` ->
  `[FellowshipResult, HeroState]`. Order: validate undertakings -> recovery ->
  (Yule extras: credit bonus skill BEFORE spend) -> `runProgression` -> record.
- CLI: `src/cli/fellowship.ts` + `fellowshipScenario.ts`; `npm run fellowship`.

## Decisions locked (this session)

- **RNG-free wrapper** -- mirrors progression; no `Rng` in any signature.
- **Improve-stats delegates to `runProgression`** (earn -> spend -> shadow-path),
  not re-implemented. The Fellowship Phase only credits the Yule bonus skill
  points first, then calls it.
- **Undertakings are recorded, not executed.** Their mechanical effects
  (heal_scars scar removal, study_maps journey buff, raise_heir, change items,
  perform/write song checks, gather rumours, strengthen fellowship) are deferred,
  same record-keys model as Progression's Reward/Virtue grants. perform_songs /
  write_song would need a SONG check (RNG), which would break the RNG-free
  wrapper -- a separate entry point later, not `runFellowship`.
- **Yule extras**: full hope (in recovery), bonus skill = WITS rating credited
  BEFORE spend, aging returned as `agedYears` (no age field -> Stage 4).
- **Shadow-reduction input is a named deed tier** (minor/active/great_deeds, or
  null = no success). Amount resolved from the struktura tiers and cross-checked
  against `kv.solo.shadow_recovery` (solo-canonical, phase:fellowship).
- **Duration / place are opaque descriptors.** No day arithmetic (the cards carry
  no day counts); a Yule phase must use the longest descriptor; place semantics
  ("safe", "previously_visited") are narrative and not validated.
- Recovery removes Shadow **points**, never scars (scars are the heal_scars
  undertaking, deferred).

## Deferred / open (carried forward)

- **Undertaking effects** (all of them) -- need the Stage-4 economy and/or an
  RNG check entry; the wrapper records the chosen keys today.
- **Messenger content gap (unchanged):** `wandering_madness` (messenger card) vs
  `wandering` (Shadow-Path card). The engine refuses to alias; pinned by
  `test/progression/shadowPath.test.ts`. Fix at a content gate.
- **Sec 3.7 solo-overlay combat-task buff distribution** -- empty cards; content
  gate before the engine can interpret.

## What is next

Stage 1 is closed. Per the architecture roadmap the next stage is **Stage 2
(narrative / eval)**, the open-ended wildcard (LLM Keeper prompts, the anti-slop
protocol, evals against deterministic engine outputs). Do not start Stage 3 (PWA)
work before Stage 2's exit criterion, except on explicit request. The Fellowship
Phase `FellowshipResult` is a clean structured input for the narrative layer
(recovery deltas, grants, undertaking keys to narrate).

## Public API delivered by the Fellowship Phase

`fellowshipConfigFromPack`, `runFellowship`, `applySpiritualRecovery`,
`applyYule`, `validateUndertakings`, the `deriveX` config seams, and the types
(`FellowshipConfig`, `FellowshipInput`, `FellowshipResult`, `RecoveryResult`,
`YuleResult`, `RecoveryModel`, `YuleModel`, `UndertakingModel`, `UndertakingMeta`).
All exported from `fellowship/index.js` and the root barrel.
