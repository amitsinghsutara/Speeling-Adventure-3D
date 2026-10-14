import { describe, expect, it } from "vitest";
import { sampleCatmullRom } from "@/game/world/curve";
import { buildRibbonGeometry } from "@/game/world/path";
import { distanceToPolylineXZ, type Vec3 } from "@/game/world/vec";

const CONTROL: readonly Vec3[] = [
  [0, 0, 0],
  [2, 0, -5],
  [-1, 0, -10],
  [0, 0, -15],
];

describe("sampleCatmullRom", () => {
  it("passes through every control point", () => {
    const segments = 4;
    const samples = sampleCatmullRom(CONTROL, segments);
    expect(samples).toHaveLength((CONTROL.length - 1) * segments + 1);
    CONTROL.forEach((point, i) => {
      const sample = samples[i * segments];
      expect(sample).toBeDefined();
      expect(sample?.[0]).toBeCloseTo(point[0], 6);
      expect(sample?.[2]).toBeCloseTo(point[2], 6);
    });
  });

  it("returns the input unchanged for fewer than two points", () => {
    expect(sampleCatmullRom([[1, 2, 3]], 5)).toEqual([[1, 2, 3]]);
    expect(sampleCatmullRom([], 5)).toEqual([]);
  });
});

describe("buildRibbonGeometry", () => {
  it("creates two vertices per sample and two triangles per span", () => {
    const line = sampleCatmullRom(CONTROL, 3);
    const ribbon = buildRibbonGeometry(line, 2, 0.05);
    expect(ribbon.positions).toHaveLength(line.length * 2 * 3);
    expect(ribbon.normals).toHaveLength(line.length * 2 * 3);
    expect(ribbon.uvs).toHaveLength(line.length * 2 * 2);
    expect(ribbon.indices).toHaveLength((line.length - 1) * 6);
  });

  it("keeps every vertex at the requested height with no NaNs", () => {
    const ribbon = buildRibbonGeometry(CONTROL, 2.5, 0.07);
    for (let i = 0; i < ribbon.positions.length; i += 3) {
      const y = ribbon.positions[i + 1];
      expect(y).toBeCloseTo(0.07, 6);
      expect(Number.isNaN(ribbon.positions[i])).toBe(false);
      expect(Number.isNaN(ribbon.positions[i + 2])).toBe(false);
    }
  });

  it("separates the left and right edges by the ribbon width", () => {
    const width = 3;
    const ribbon = buildRibbonGeometry(CONTROL, width);
    for (let i = 0; i < CONTROL.length; i += 1) {
      const l = i * 6;
      const r = l + 3;
      const dx = (ribbon.positions[r] ?? 0) - (ribbon.positions[l] ?? 0);
      const dz = (ribbon.positions[r + 2] ?? 0) - (ribbon.positions[l + 2] ?? 0);
      expect(Math.hypot(dx, dz)).toBeCloseTo(width, 5);
    }
  });

  it("winds triangles counter-clockwise when viewed from above", () => {
    const ribbon = buildRibbonGeometry(CONTROL, 2);
    const p = ribbon.positions;
    const read = (index: number): Vec3 => [
      p[index * 3] ?? 0,
      p[index * 3 + 1] ?? 0,
      p[index * 3 + 2] ?? 0,
    ];
    for (let t = 0; t < ribbon.indices.length; t += 3) {
      const a = read(ribbon.indices[t] ?? 0);
      const b = read(ribbon.indices[t + 1] ?? 0);
      const c = read(ribbon.indices[t + 2] ?? 0);
      // Y component of (b - a) × (c - a) must be positive for an upward face.
      const cross =
        (c[0] - a[0]) * (b[2] - a[2]) - (b[0] - a[0]) * (c[2] - a[2]);
      expect(cross).toBeGreaterThan(0);
    }
  });

  it("returns empty buffers for a degenerate line", () => {
    const ribbon = buildRibbonGeometry([[0, 0, 0]], 2);
    expect(ribbon.positions).toHaveLength(0);
    expect(ribbon.indices).toHaveLength(0);
  });
});

describe("distanceToPolylineXZ", () => {
  it("measures perpendicular distance to the nearest segment", () => {
    const line: readonly Vec3[] = [
      [0, 0, 0],
      [10, 0, 0],
    ];
    expect(distanceToPolylineXZ([5, 7, 3], line)).toBeCloseTo(3);
    expect(distanceToPolylineXZ([-4, 0, 0], line)).toBeCloseTo(4);
    expect(distanceToPolylineXZ([13, 0, 4], line)).toBeCloseTo(5);
  });

  it("is infinite for an empty line", () => {
    expect(distanceToPolylineXZ([0, 0, 0], [])).toBe(Number.POSITIVE_INFINITY);
  });
});
