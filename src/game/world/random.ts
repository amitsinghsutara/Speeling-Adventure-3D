/**
 * Small deterministic PRNG (mulberry32). The world layout must be
 * reproducible so tests, screenshots and bug reports all see the same meadow.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(
  next: () => number,
  min: number,
  max: number,
): number {
  return min + (max - min) * next();
}
