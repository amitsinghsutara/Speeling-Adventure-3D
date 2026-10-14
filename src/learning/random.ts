/** A source of floats in [0, 1). Injected everywhere so play is reproducible in tests. */
export type RandomSource = () => number;

/**
 * Small seeded PRNG (mulberry32). Deterministic for a given seed, so a recorded
 * seed is enough to replay a session's shuffles and adaptive tie-breaks.
 */
export function seededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
