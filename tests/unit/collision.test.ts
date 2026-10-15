import { describe, expect, it } from "vitest";
import {
  PLAYABLE_RADIUS,
  TRUNK_COLLIDER_RADIUS,
  buildColliders,
  resolveCircleCollisions,
} from "@/game/world/collision";
import { generateMeadowLayout } from "@/game/world/layout";

const OBSTACLE = { x: 5, z: 0, radius: 1 };

describe("resolveCircleCollisions", () => {
  it("leaves a free position unchanged", () => {
    expect(resolveCircleCollisions(0, 0, 0.5, [OBSTACLE], 30)).toEqual({
      x: 0,
      z: 0,
    });
  });

  it("pushes the character out of an overlapping obstacle", () => {
    const result = resolveCircleCollisions(4.2, 0, 0.5, [OBSTACLE], 30);
    expect(result.x).toBeCloseTo(3.5);
    expect(result.z).toBeCloseTo(0);
  });

  it("slides along an obstacle rather than snapping back", () => {
    const result = resolveCircleCollisions(4.3, 0.4, 0.5, [OBSTACLE], 30);
    const distance = Math.hypot(result.x - OBSTACLE.x, result.z - OBSTACLE.z);
    expect(distance).toBeCloseTo(1.5);
    expect(result.z).toBeGreaterThan(0.4);
  });

  it("keeps the character inside the circular boundary", () => {
    const result = resolveCircleCollisions(40, 30, 0.5, [], 30);
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(29.5);
  });

  it("handles a character exactly on an obstacle centre", () => {
    const result = resolveCircleCollisions(5, 0, 0.5, [OBSTACLE], 30);
    expect(Math.hypot(result.x - 5, result.z)).toBeCloseTo(1.5);
  });
});

describe("buildColliders", () => {
  it("creates walk colliders for trees, rocks and signposts, and camera obstacles for trees", () => {
    const layout = generateMeadowLayout({
      seed: 7,
      treeCount: 10,
      forestTreeCount: 0,
      bushCount: 0,
      grassCount: 0,
      flowerCount: 5,
      rockCount: 3,
      cloudCount: 1,
    });
    const colliders = buildColliders(layout);
    // 10 trunks + 5 signposts + 1 gate + 3 rocks
    expect(colliders.walk).toHaveLength(19);
    expect(layout.interactables).toHaveLength(6);
    expect(colliders.camera).toHaveLength(10);
    expect(colliders.walk[0]?.radius).toBe(TRUNK_COLLIDER_RADIUS);
    expect(colliders.camera[0]?.radius).toBe(layout.trees[0]?.canopyRadius);
    expect(colliders.boundsRadius).toBe(PLAYABLE_RADIUS);
  });
});
