import type { Vec3 } from "./vec";

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Samples a uniform Catmull-Rom spline through `points` with clamped ends.
 * The result passes through every control point and contains
 * `(points.length - 1) * segmentsPerSpan + 1` samples.
 */
export function sampleCatmullRom(
  points: readonly Vec3[],
  segmentsPerSpan: number,
): Vec3[] {
  if (points.length < 2) return [...points];
  const segments = Math.max(1, Math.floor(segmentsPerSpan));
  const out: Vec3[] = [];
  const last = points.length - 1;

  for (let i = 0; i < last; i += 1) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, last)];
    if (!p0 || !p1 || !p2 || !p3) continue;
    const steps = i === last - 1 ? segments + 1 : segments;
    for (let s = 0; s < steps; s += 1) {
      const t = s / segments;
      out.push([
        catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        catmullRom(p0[2], p1[2], p2[2], p3[2], t),
      ]);
    }
  }
  return out;
}
