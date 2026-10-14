import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_TUNING,
  clipDistanceToObstacles,
  createCameraState,
  stepFollowCamera,
  type CameraState,
} from "@/game/camera/followCamera";
import type { Vec3 } from "@/game/world/vec";

const NO_LOOK = { x: 0, y: 0 };

function settle(
  state: CameraState,
  target: Vec3,
  targetYaw: number,
  moving: boolean,
  seconds: number,
  obstacles: Parameters<typeof stepFollowCamera>[6] = [],
): CameraState {
  let s = state;
  for (let i = 0; i < seconds * 60; i += 1) {
    s = stepFollowCamera(s, target, targetYaw, moving, NO_LOOK, 1 / 60, obstacles);
  }
  return s;
}

describe("createCameraState", () => {
  it("starts behind and above the target", () => {
    const state = createCameraState([0, 0, 10], 0);
    expect(state.position[2]).toBeCloseTo(10 + DEFAULT_CAMERA_TUNING.distance);
    expect(state.position[1]).toBeCloseTo(DEFAULT_CAMERA_TUNING.height);
    expect(state.lookAt[1]).toBeCloseTo(DEFAULT_CAMERA_TUNING.lookHeight);
  });
});

describe("stepFollowCamera", () => {
  it("swings round behind a character that turned and is moving", () => {
    const start = createCameraState([0, 0, 0], 0);
    const facingPlusX = -Math.PI / 2;
    const settled = settle(start, [0, 0, 0], facingPlusX, true, 4);
    expect(settled.yaw).toBeCloseTo(facingPlusX, 1);
    // Behind a character facing +X means the camera is on the −X side.
    expect(settled.position[0]).toBeLessThan(-6);
  });

  it("does not auto-follow while the character stands still", () => {
    const start = createCameraState([0, 0, 0], 0);
    const settled = settle(start, [0, 0, 0], Math.PI / 2, false, 2);
    expect(settled.yaw).toBe(0);
  });

  it("lets a drag orbit the camera and pauses auto-follow", () => {
    const start = createCameraState([0, 0, 0], 0);
    const dragged = stepFollowCamera(
      start,
      [0, 0, 0],
      0,
      true,
      { x: 100, y: 0 },
      1 / 60,
      [],
    );
    expect(dragged.yaw).toBeCloseTo(-100 * DEFAULT_CAMERA_TUNING.lookSensitivity);
    expect(dragged.followPause).toBe(DEFAULT_CAMERA_TUNING.followPauseSeconds);
    const shortlyAfter = settle(dragged, [0, 0, 0], 0, true, 0.5);
    expect(shortlyAfter.yaw).toBeCloseTo(dragged.yaw, 5);
  });

  it("follows the target position smoothly", () => {
    const start = createCameraState([0, 0, 0], 0);
    const settled = settle(start, [0, 0, -20], 0, true, 3);
    expect(settled.position[2]).toBeCloseTo(-20 + DEFAULT_CAMERA_TUNING.distance, 1);
    expect(settled.lookAt[2]).toBeCloseTo(-20, 1);
  });

  it("pulls in when a tree is between the camera and the character", () => {
    const tree = { x: 0, z: 4, radius: 1.5 };
    const start = createCameraState([0, 0, 0], 0);
    const settled = settle(start, [0, 0, 0], 0, false, 3, [tree]);
    expect(settled.position[2]).toBeLessThan(4 - 1.5);
    expect(settled.position[2]).toBeGreaterThan(DEFAULT_CAMERA_TUNING.minDistance - 0.01);
  });
});

describe("clipDistanceToObstacles", () => {
  it("returns the full distance when nothing is in the way", () => {
    expect(clipDistanceToObstacles(0, 0, 0, 1, 7, [{ x: 5, z: 0, radius: 1 }], 0.3, 1)).toBe(7);
  });

  it("stops before the first obstacle along the ray", () => {
    const d = clipDistanceToObstacles(
      0,
      0,
      0,
      1,
      7,
      [
        { x: 0, z: 6, radius: 1 },
        { x: 0, z: 3, radius: 0.5 },
      ],
      0.2,
      1,
    );
    expect(d).toBeCloseTo(3 - 0.7);
  });

  it("never goes below the minimum distance", () => {
    expect(clipDistanceToObstacles(0, 0, 0, 1, 7, [{ x: 0, z: 1, radius: 0.5 }], 0.3, 1.8)).toBe(1.8);
  });

  it("ignores an obstacle the target is already inside", () => {
    expect(clipDistanceToObstacles(0, 0, 0, 1, 7, [{ x: 0, z: 0, radius: 2 }], 0.3, 1)).toBe(7);
  });
});
