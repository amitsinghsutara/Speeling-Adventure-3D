import type { Vec3 } from "./vec";

export interface RibbonGeometryData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

/**
 * Builds a flat ribbon (two vertices per sample) that follows a polyline in
 * the XZ plane, used for forest paths. Triangles wind counter-clockwise when
 * viewed from above so the ribbon faces +Y. Pure data; the renderer wraps it
 * in a BufferGeometry.
 */
export function buildRibbonGeometry(
  centreline: readonly Vec3[],
  width: number,
  y = 0.03,
): RibbonGeometryData {
  const n = centreline.length;
  if (n < 2) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      uvs: new Float32Array(0),
      indices: new Uint16Array(0),
    };
  }

  const half = width / 2;
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const vertexCount = n * 2;
  const indices =
    vertexCount > 65535
      ? new Uint32Array((n - 1) * 6)
      : new Uint16Array((n - 1) * 6);

  let travelled = 0;
  for (let i = 0; i < n; i += 1) {
    const p = centreline[i];
    const prev = centreline[Math.max(i - 1, 0)];
    const next = centreline[Math.min(i + 1, n - 1)];
    if (!p || !prev || !next) continue;

    let tx = next[0] - prev[0];
    let tz = next[2] - prev[2];
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // Perpendicular in XZ (rotate tangent +90° about Y).
    const nx = -tz;
    const nz = tx;

    if (i > 0) {
      travelled += Math.hypot(p[0] - prev[0], p[2] - prev[2]);
    }

    const left = i * 2;
    const right = left + 1;
    positions.set([p[0] - nx * half, y, p[2] - nz * half], left * 3);
    positions.set([p[0] + nx * half, y, p[2] + nz * half], right * 3);
    normals.set([0, 1, 0], left * 3);
    normals.set([0, 1, 0], right * 3);
    uvs.set([0, travelled], left * 2);
    uvs.set([1, travelled], right * 2);
  }

  for (let i = 0; i < n - 1; i += 1) {
    const l0 = i * 2;
    const r0 = l0 + 1;
    const l1 = l0 + 2;
    const r1 = l0 + 3;
    indices.set([l0, r0, l1, r0, r1, l1], i * 6);
  }

  return { positions, normals, uvs, indices };
}
