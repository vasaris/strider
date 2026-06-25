# engine/

Brodyazhnik rules engine — a pure, deterministic TypeScript library.

## Invariants (architecture principles)

- **No pack content here.** This package holds zero rules text and zero book
  numbers. Rule numbers are derived from the verified content pack
  (`content-packs/kv/`) at construction time; the engine math is parameterised
  by config objects only. This is the legal-cleanliness boundary (§10) and the
  TS mirror of the content discipline.
- **Pure functions, no side effects.** Rolls thread an immutable RNG value:
  `(rng) -> [value, rng']`. Subsystem calls take `(config, ..., rng)` and return
  `[result, rng']`.
- **Seedable RNG.** Every roll is reproducible from a seed; persisting the RNG
  state is what makes a saved game resume reproducibly.

## Layout (Stage 1)

```
src/
  rng/      seedable PRNG (sfc32) + rejection-sampled bounded ints
  pack/     manifest-gated loader (refuses unverified packs) + config providers
  dice/     Feat / Success dice, modifiers, check-level roll
  checks/   target number, evaluate, degrees, special successes, risk, hope
  oracles/  answers, lore, feat-die events (luck / misfortune / detection)
  eye/      Eye of Mordor: initial rating, growth, pursuit threshold, detection
  journey/  integrator: effect interpreter, scene resolution, travel loop
  cli/      milestone journey driver (no LLM)
test/       seeded-RNG unit tests + golden milestone journey
```

The Stage-1 exit criterion is met: a reproducible CLI journey playthrough on a
test hero, no LLM, on a seeded RNG. Build order to here:
Dice -> Checks -> Pack loader -> Oracles -> Eye -> Journey.

## Commands

```
npm install
npm run typecheck   # tsc --noEmit, strict
npm test            # vitest run
npm run journey     # run the milestone journey, print a structured transcript
```

