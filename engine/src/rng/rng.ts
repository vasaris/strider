/**
 * Seedable, reproducible, side-effect-free RNG.
 *
 * Architecture principle #4: every roll is reproducible. We never touch
 * Math.random (not seedable). The RNG state is an immutable value; each draw
 * returns the advanced state, so callers thread it explicitly:
 *   const [u, rng2] = nextU32(rng1);
 * Persisting this state is what makes "close the tab, resume next week"
 * reproducible end to end.
 *
 * Algorithm: sfc32 (128-bit state) seeded via cyrb128. Public-domain PRNGs
 * (Chris Doty-Humphrey's sfc, bryc's JS transcriptions). Chosen for quality
 * (passes PractRand) at a tiny pure-TS footprint.
 */

/** Immutable RNG state. Treat as opaque; produce via makeRng. */
export interface Rng {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

const U32 = 0x1_0000_0000; // 2^32

/** Hash an arbitrary seed string into four 32-bit lanes (cyrb128). */
function cyrb128(str: string): readonly [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const seed1 = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
  const seed2 = (h2 ^ h1) >>> 0;
  const seed3 = (h3 ^ h1) >>> 0;
  const seed4 = (h4 ^ h1) >>> 0;
  return [seed1, seed2, seed3, seed4] as const;
}

/**
 * Advance the RNG one step, returning a uint32 [0, 2^32) and the next state.
 * Pure: same input value always yields the same output pair.
 */
export function nextU32(rng: Rng): readonly [number, Rng] {
  let { a, b, c } = rng;
  let d = rng.d;
  a |= 0;
  b |= 0;
  c |= 0;
  d |= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [t >>> 0, { a, b, c, d }] as const;
}

const WARMUP_STEPS = 15; // sfc32 mixes poorly in the first few outputs after seeding

/** Build an RNG from a numeric or string seed (deterministic). */
export function makeRng(seed: number | string): Rng {
  const [a, b, c, d] = cyrb128(String(seed));
  let rng: Rng = { a, b, c, d };
  for (let i = 0; i < WARMUP_STEPS; i++) {
    rng = nextU32(rng)[1];
  }
  return rng;
}

/**
 * Uniform integer in [0, n) via rejection sampling — exactly uniform, with no
 * modulo bias. Bias matters: distribution unit tests use chi-square, and a
 * skewed low-order modulo would fail them for the right reason.
 */
export function randIntBelow(n: number, rng: Rng): readonly [number, Rng] {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`randIntBelow: n must be a positive integer, got ${n}`);
  }
  const limit = Math.floor(U32 / n) * n; // largest multiple of n that fits in u32
  let cur = rng;
  for (;;) {
    const [u, next] = nextU32(cur);
    cur = next;
    if (u < limit) {
      return [u % n, cur] as const;
    }
  }
}

/** Roll a single die with `sides` faces, returning a face in [1, sides]. */
export function rollDie(sides: number, rng: Rng): readonly [number, Rng] {
  const [zeroBased, next] = randIntBelow(sides, rng);
  return [zeroBased + 1, next] as const;
}
