import { shortestAngleDelta, smoothingFactor } from "@/game/character/controller";
import type { LookDelta } from "@/game/input/inputHub";
import type { CircleCollider } from "@/game/world/collision";
import type { Vec3 } from "@/game/world/vec";

export interface CameraTuning {
  readonly distance: number;
  readonly height: number;
  readonly lookHeight: number;
  /** Yaw ease rate (1/s) towards "behind the character" while moving. */
  readonly followRate: number;
  readonly positionRate: number;
  readonly lookRate: number;
  /** Radians of yaw per pixel of drag. */
  readonly lookSensitivity: number;
  readonly minDistance: number;
  readonly obstacleMargin: number;
  /** Seconds after a manual look before auto-follow resumes. */
  readonly followPauseSeconds: number;
}

export const DEFAULT_CAMERA_TUNING: CameraTuning = {
  distance: 7,
  height: 3.4,
  lookHeight: 1.1,
  followRate: 2.2,
  positionRate: 9,
  lookRate: 14,
  lookSensitivity: 0.0045,
  minDistance: 1.8,
  obstacleMargin: 0.35,
  followPauseSeconds: 1.2,
};

export interface CameraState {
  /** Orbit yaw: the camera sits at target + (sin yaw, height, cos yaw) × distance. */
  readonly yaw: number;
  readonly position: Vec3;
  readonly lookAt: Vec3;
  readonly followPause: number;
}

function desiredPosition(
  target: Vec3,
  yaw: number,
  distance: number,
  height: number,
): Vec3 {
  return [
    target[0] + Math.sin(yaw) * distance,
    target[1] + height,
    target[2] + Math.cos(yaw) * distance,
  ];
}

export function createCameraState(
  target: Vec3,
  yaw: number,
  tuning: CameraTuning = DEFAULT_CAMERA_TUNING,
): CameraState {
  return {
    yaw,
    position: desiredPosition(target, yaw, tuning.distance, tuning.height),
    lookAt: [target[0], target[1] + tuning.lookHeight, target[2]],
    followPause: 0,
  };
}

/**
 * Shortens `distance` so the segment from (fromX, fromZ) along (dirX, dirZ)
 * stops before the first obstacle circle (grown by `margin`).
 */
export function clipDistanceToObstacles(
  fromX: number,
  fromZ: number,
  dirX: number,
  dirZ: number,
  distance: number,
  obstacles: readonly CircleCollider[],
  margin: number,
  minDistance: number,
): number {
  let clipped = distance;
  for (const o of obstacles) {
    const r = o.radius + margin;
    const fx = fromX - o.x;
    const fz = fromZ - o.z;
    const c = fx * fx + fz * fz - r * r;
    if (c < 0) continue; // Target is inside this circle; nothing sensible to do.
    const b = fx * dirX + fz * dirZ;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < clipped) clipped = t;
  }
  return Math.max(minDistance, clipped);
}

/**
 * Advances the follow camera. Pure: returns a new state. The caller copies
 * `position` and `lookAt` onto the Three.js camera.
 */
export function stepFollowCamera(
  state: CameraState,
  target: Vec3,
  targetYaw: number,
  moving: boolean,
  look: LookDelta,
  dt: number,
  obstacles: readonly CircleCollider[],
  tuning: CameraTuning = DEFAULT_CAMERA_TUNING,
): CameraState {
  let yaw = state.yaw;
  let followPause = Math.max(0, state.followPause - dt);

  if (look.x !== 0) {
    yaw -= look.x * tuning.lookSensitivity;
    followPause = tuning.followPauseSeconds;
  } else if (moving && followPause === 0) {
    yaw += shortestAngleDelta(yaw, targetYaw) * smoothingFactor(tuning.followRate, dt);
  }

  const dirX = Math.sin(yaw);
  const dirZ = Math.cos(yaw);
  const distance = clipDistanceToObstacles(
    target[0],
    target[2],
    dirX,
    dirZ,
    tuning.distance,
    obstacles,
    tuning.obstacleMargin,
    tuning.minDistance,
  );
  // Keep the camera height proportional when pulled in so it does not dive.
  const height = tuning.height * Math.max(0.55, distance / tuning.distance);
  const desired = desiredPosition(target, yaw, distance, height);
  const desiredLook: Vec3 = [
    target[0],
    target[1] + tuning.lookHeight,
    target[2],
  ];

  const pBlend = smoothingFactor(tuning.positionRate, dt);
  const lBlend = smoothingFactor(tuning.lookRate, dt);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return {
    yaw,
    followPause,
    position: [
      lerp(state.position[0], desired[0], pBlend),
      lerp(state.position[1], desired[1], pBlend),
      lerp(state.position[2], desired[2], pBlend),
    ],
    lookAt: [
      lerp(state.lookAt[0], desiredLook[0], lBlend),
      lerp(state.lookAt[1], desiredLook[1], lBlend),
      lerp(state.lookAt[2], desiredLook[2], lBlend),
    ],
  };
}
