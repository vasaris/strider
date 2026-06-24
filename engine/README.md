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

## Layout (Stage 1, in progress)

```
src/
  rng/      seedable PRNG (sfc32) + rejection-sampled bounded ints
  dice/     Feat / Success dice, modifiers, check-level roll  [done]
            config.ts  derives DiceConfig from verified rule cards
test/       seeded-RNG unit tests (distributions, semantics, golden)
```

Build order toward the Stage-1 milestone (CLI journey playthrough, no LLM):
Dice -> Checks -> Oracles -> Eye -> Journey.

## Commands

```
npm install
npm run typecheck   # tsc --noEmit, strict
npm test            # vitest run
```
