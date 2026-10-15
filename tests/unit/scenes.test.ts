import { describe, expect, it } from "vitest";
import { generateMeadowLayout, sceneInteractables } from "@/game/world/layout";
import { MAX_LEVEL, sceneForLevel } from "@/game/world/scenes";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { createCurriculumLearningService } from "@/learning/service";

const COUNTS = { treeCount: 10, forestTreeCount: 20, bushCount: 5, grassCount: 50, flowerCount: 10, rockCount: 3, cloudCount: 2 };

describe("sceneForLevel", () => {
  it("gives every level a name, seed and palette, cycling palettes with numbered names", () => {
    const names = new Set<string>();
    const seeds = new Set<number>();
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const scene = sceneForLevel(level);
      expect(scene.level).toBe(level);
      expect(scene.palette.canopy.length).toBeGreaterThan(0);
      names.add(scene.name);
      seeds.add(scene.seed);
    }
    expect(names.size).toBe(MAX_LEVEL);
    expect(seeds.size).toBe(MAX_LEVEL);
    expect(sceneForLevel(1).name).toBe("Sunny Meadow");
    expect(sceneForLevel(2).name).toBe("Autumn Woods");
    expect(sceneForLevel(5).name).toBe("Sunny Meadow 2");
  });

  it("clamps out-of-range levels", () => {
    expect(sceneForLevel(0).level).toBe(1);
    expect(sceneForLevel(99).level).toBe(MAX_LEVEL);
  });
});

describe("sceneInteractables", () => {
  it("has five signs for the level's puzzles, an exit gate, and an entry gate from level 2", () => {
    const level1 = sceneInteractables(1);
    expect(level1.filter((i) => i.questId).map((i) => i.questId)).toEqual([
      "level-1/puzzle-1",
      "level-1/puzzle-2",
      "level-1/puzzle-3",
      "level-1/puzzle-4",
      "level-1/puzzle-5",
    ]);
    expect(level1.filter((i) => i.travelToLevel !== undefined).map((i) => i.travelToLevel)).toEqual([2]);
    const level3 = sceneInteractables(3);
    expect(level3.filter((i) => i.travelToLevel !== undefined).map((i) => i.travelToLevel).sort()).toEqual([2, 4]);
  });

  it("builds different-looking layouts per level with the same rules", () => {
    const a = generateMeadowLayout({ ...COUNTS, level: 1 });
    const b = generateMeadowLayout({ ...COUNTS, level: 2 });
    expect(a.scene.name).toBe("Sunny Meadow");
    expect(b.scene.name).toBe("Autumn Woods");
    expect(a.palette.ground).not.toBe(b.palette.ground);
    expect(a.trees).not.toEqual(b.trees);
    expect(a.paths).toHaveLength(5);
    expect(b.interactables.filter((i) => i.questId).every((i) => i.questId?.startsWith("level-2/"))).toBe(true);
  });
});

describe("level info", () => {
  it("reports lock state and progress for a level", () => {
    const service = createCurriculumLearningService(loadCurriculum());
    expect(service.getLevelInfo(1, [])).toEqual({ level: 1, status: "available", puzzleCount: 5, completedCount: 0 });
    expect(service.getLevelInfo(2, [])).toMatchObject({ status: "locked" });
    const allLevel1 = [1, 2, 3, 4, 5].map((n) => `level-1/puzzle-${n}`);
    expect(service.getLevelInfo(1, allLevel1)).toMatchObject({ status: "completed", completedCount: 5 });
    expect(service.getLevelInfo(2, allLevel1)).toMatchObject({ status: "available", completedCount: 0 });
    expect(service.getLevelInfo(42, [])).toBeNull();
  });
});
