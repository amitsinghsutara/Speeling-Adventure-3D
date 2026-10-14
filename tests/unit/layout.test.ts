import { describe, expect, it } from "vitest";
import {
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
    expect(layout.trees).toHaveLength(OPTIONS.treeCount);
    expect(layout.flowers).toHaveLength(OPTIONS.flowerCount);
    expect(layout.rocks).toHaveLength(OPTIONS.rockCount);
    expect(layout.clouds).toHaveLength(OPTIONS.cloudCount);
    expect(layout.hills.length).toBeGreaterThan(0);
  });

  it("keeps trees off the paths, apart from each other and away from spawn", () => {
    const layout = generateMeadowLayout(OPTIONS);
    const paths = [layout.mainPath, layout.branchPath];
    for (const tree of layout.trees) {
      for (const path of paths) {
        expect(
          distanceToPolylineXZ(tree.position, path),
        ).toBeGreaterThanOrEqual(PATH_CLEARANCE);
      }
      expect(distanceXZ(tree.position, layout.fernSpawn)).toBeGreaterThanOrEqual(
        SPAWN_CLEARANCE,
      );
      expect(Math.hypot(tree.position[0], tree.position[2])).toBeLessThanOrEqual(
        MEADOW_RADIUS,
      );
    }
    for (let i = 0; i < layout.trees.length; i += 1) {
      for (let j = i + 1; j < layout.trees.length; j += 1) {
        const a = layout.trees[i];
        const b = layout.trees[j];
        if (!a || !b) throw new Error("unexpected sparse array");
        expect(distanceXZ(a.position, b.position)).toBeGreaterThanOrEqual(
          TREE_SPACING,
        );
      }
    }
  });

  it("keeps flowers and rocks inside the meadow and off the path surface", () => {
    const layout = generateMeadowLayout(OPTIONS);
    for (const item of [...layout.flowers, ...layout.rocks]) {
      expect(Math.hypot(item.position[0], item.position[2])).toBeLessThanOrEqual(
        MEADOW_RADIUS,
      );
      expect(distanceToPolylineXZ(item.position, layout.mainPath)).toBeGreaterThan(
        1,
      );
    }
  });

  it("starts Fern on the main path with the camera behind her", () => {
    const layout = generateMeadowLayout(OPTIONS);
    expect(distanceToPolylineXZ(layout.fernSpawn, layout.mainPath)).toBeLessThan(
      1,
    );
    expect(layout.cameraStart[2]).toBeGreaterThan(layout.fernSpawn[2]);
    expect(layout.cameraStart[1]).toBeGreaterThan(layout.fernSpawn[1]);
  });

  it("places hills beyond the explorable meadow", () => {
    const layout = generateMeadowLayout(OPTIONS);
    for (const hill of layout.hills) {
      expect(Math.hypot(hill.position[0], hill.position[2])).toBeGreaterThan(
        MEADOW_RADIUS,
      );
    }
  });
});
