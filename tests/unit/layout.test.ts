import { describe, expect, it } from "vitest";
import {
  BUSH_SPACING,
  FOREST_INNER_RADIUS,
  FOREST_OUTER_RADIUS,
  FOREST_SPACING,
  MEADOW_RADIUS,
  PATH_CLEARANCE,
  SPAWN_CLEARANCE,
  TREE_SPACING,
  generateMeadowLayout,
} from "@/game/world/layout";
import { distanceToPolylineXZ, distanceXZ } from "@/game/world/vec";

const OPTIONS = {
  seed: 1234,
  treeCount: 40,
  forestTreeCount: 150,
  bushCount: 30,
  flowerCount: 120,
  rockCount: 12,
  cloudCount: 8,
};

describe("generateMeadowLayout", () => {
  it("is deterministic for the same seed", () => {
    const a = generateMeadowLayout(OPTIONS);
    const b = generateMeadowLayout(OPTIONS);
    expect(a).toEqual(b);
  });

  it("changes with the seed", () => {
    const a = generateMeadowLayout(OPTIONS);
    const b = generateMeadowLayout({ ...OPTIONS, seed: 99 });
    expect(a.trees).not.toEqual(b.trees);
  });

  it("places the requested number of objects", () => {
    const layout = generateMeadowLayout(OPTIONS);
    expect(layout.trees.filter((t) => !t.inForestBelt)).toHaveLength(OPTIONS.treeCount);
    expect(layout.trees.filter((t) => t.inForestBelt)).toHaveLength(OPTIONS.forestTreeCount);
    expect(layout.bushes).toHaveLength(OPTIONS.bushCount);
    expect(layout.flowers).toHaveLength(OPTIONS.flowerCount);
    expect(layout.rocks).toHaveLength(OPTIONS.rockCount);
    expect(layout.clouds).toHaveLength(OPTIONS.cloudCount);
    expect(layout.hills.length).toBeGreaterThan(0);
  });

  it("grows mostly conifers with some round trees, and varies lean", () => {
    const layout = generateMeadowLayout(OPTIONS);
    const conifers = layout.trees.filter((t) => t.kind === "conifer").length;
    expect(conifers / layout.trees.length).toBeGreaterThan(0.7);
    expect(layout.trees.some((t) => t.kind === "round")).toBe(true);
    expect(layout.trees.every((t) => Math.abs(t.leanX) <= 0.05 && Math.abs(t.leanZ) <= 0.05)).toBe(true);
    expect(new Set(layout.trees.map((t) => t.leanX)).size).toBeGreaterThan(10);
  });

  it("keeps meadow trees off the paths, apart from each other and away from spawn", () => {
    const layout = generateMeadowLayout(OPTIONS);
    const paths = [layout.mainPath, layout.branchPath];
    const meadowTrees = layout.trees.filter((t) => !t.inForestBelt);
    for (const tree of meadowTrees) {
      for (const path of paths) {
        expect(distanceToPolylineXZ(tree.position, path)).toBeGreaterThanOrEqual(PATH_CLEARANCE);
      }
      expect(distanceXZ(tree.position, layout.fernSpawn)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE);
      expect(Math.hypot(tree.position[0], tree.position[2])).toBeLessThanOrEqual(MEADOW_RADIUS);
    }
    for (let i = 0; i < meadowTrees.length; i += 1) {
      for (let j = i + 1; j < meadowTrees.length; j += 1) {
        const a = meadowTrees[i];
        const b = meadowTrees[j];
        if (!a || !b) throw new Error("unexpected sparse array");
        expect(distanceXZ(a.position, b.position)).toBeGreaterThanOrEqual(TREE_SPACING);
      }
    }
  });

  it("packs the forest belt densely around the meadow edge, leaving the paths open", () => {
    const layout = generateMeadowLayout(OPTIONS);
    const belt = layout.trees.filter((t) => t.inForestBelt);
    for (const tree of belt) {
      const r = Math.hypot(tree.position[0], tree.position[2]);
      expect(r).toBeGreaterThanOrEqual(FOREST_INNER_RADIUS - 0.01);
      expect(r).toBeLessThanOrEqual(FOREST_OUTER_RADIUS + 0.01);
      expect(distanceToPolylineXZ(tree.position, layout.mainPath)).toBeGreaterThanOrEqual(PATH_CLEARANCE);
      expect(distanceToPolylineXZ(tree.position, layout.branchPath)).toBeGreaterThanOrEqual(PATH_CLEARANCE);
    }
    for (let i = 0; i < belt.length; i += 1) {
      for (let j = i + 1; j < belt.length; j += 1) {
        expect(distanceXZ(belt[i]!.position, belt[j]!.position)).toBeGreaterThanOrEqual(FOREST_SPACING);
      }
    }
    expect(belt.length).toBeGreaterThan(layout.trees.length / 2);
  });

  it("keeps bushes off the path, apart, and clear of trunks", () => {
    const layout = generateMeadowLayout(OPTIONS);
    for (const bush of layout.bushes) {
      expect(distanceToPolylineXZ(bush.position, layout.mainPath)).toBeGreaterThan(1.5);
      expect(layout.trees.every((t) => distanceXZ(t.position, bush.position) >= 1.1)).toBe(true);
      expect(distanceXZ(bush.position, layout.fernSpawn)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE);
    }
    for (let i = 0; i < layout.bushes.length; i += 1) {
      for (let j = i + 1; j < layout.bushes.length; j += 1) {
        expect(distanceXZ(layout.bushes[i]!.position, layout.bushes[j]!.position)).toBeGreaterThanOrEqual(BUSH_SPACING);
      }
    }
  });

  it("keeps flowers and rocks inside the meadow and off the path surface", () => {
    const layout = generateMeadowLayout(OPTIONS);
    for (const item of [...layout.flowers, ...layout.rocks]) {
      expect(Math.hypot(item.position[0], item.position[2])).toBeLessThanOrEqual(MEADOW_RADIUS);
      expect(distanceToPolylineXZ(item.position, layout.mainPath)).toBeGreaterThan(1);
    }
  });

  it("starts Fern on the main path with the camera behind her", () => {
    const layout = generateMeadowLayout(OPTIONS);
    expect(distanceToPolylineXZ(layout.fernSpawn, layout.mainPath)).toBeLessThan(1);
    expect(layout.cameraStart[2]).toBeGreaterThan(layout.fernSpawn[2]);
    expect(layout.cameraStart[1]).toBeGreaterThan(layout.fernSpawn[1]);
  });

  it("places hills beyond the explorable meadow", () => {
    const layout = generateMeadowLayout(OPTIONS);
    for (const hill of layout.hills) {
      expect(Math.hypot(hill.position[0], hill.position[2])).toBeGreaterThan(MEADOW_RADIUS);
    }
  });
});
