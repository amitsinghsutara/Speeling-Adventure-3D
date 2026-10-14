/** Immutable [x, y, z] tuple. Y is up; the ground plane is XZ. */
export type Vec3 = readonly [number, number, number];

export function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dz);
}

/** Distance in the XZ plane from a point to a segment a→b. */
export function distanceToSegmentXZ(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apz = p[2] - a[2];
  const lengthSq = abx * abx + abz * abz;
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, (apx * abx + apz * abz) / lengthSq));
  const cx = a[0] + abx * t;
  const cz = a[2] + abz * t;
  return Math.hypot(p[0] - cx, p[2] - cz);
}

/** Shortest XZ distance from a point to an open polyline. */
export function distanceToPolylineXZ(p: Vec3, line: readonly Vec3[]): number {
  if (line.length === 0) return Number.POSITIVE_INFINITY;
  const first = line[0];
  if (line.length === 1 || first === undefined) {
    return first ? distanceXZ(p, first) : Number.POSITIVE_INFINITY;
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (!a || !b) continue;
    best = Math.min(best, distanceToSegmentXZ(p, a, b));
  }
  return best;
}
