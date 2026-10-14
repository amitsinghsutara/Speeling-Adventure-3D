import type { MoveIntent } from "@/game/input/inputHub";
import type { Vec3 } from "@/game/world/vec";
import type { CharacterAnimationState } from "./types";

export interface CharacterTuning {
  readonly walkSpeed: number;
  readonly runSpeed: number;
  /** Exponential rate (1/s) at which velocity approaches the target. */
  readonly acceleration: number;
  readonly deceleration: number;
  /** Exponential rate (1/s) at which yaw approaches the travel direction. */
  readonly turnSharpness: number;
  readonly radius: number;
}

export const DEFAULT_CHARACTER_TUNING: CharacterTuning = {
  walkSpeed: 3.2,
  runSpeed: 6.4,
  acceleration: 12,
  deceleration: 16,
  turnSharpness: 12,
  radius: 0.45,
};

export interface CharacterState {
  readonly position: Vec3;
  /** Rotation about Y; 0 faces −Z. */
  readonly yaw: number;
  /** Horizontal velocity [x, z] in m/s. */
  readonly velocity: readonly [number, number];
  readonly speed: number;
  readonly animation: CharacterAnimationState;
}

export function createCharacterState(position: Vec3, yaw: number): CharacterState {
  return { position, yaw, velocity: [0, 0], speed: 0, animation: "idle" };
}

/** Smallest signed rotation from `from` to `to`, in (−π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/** Wraps an angle into (−π, π]. */
export function wrapAngle(angle: number): number {
  return shortestAngleDelta(0, angle);
}

/**
 * Camera yaw used to interpret stick input. It is latched when a push starts
 * and held until the stick returns to centre, so holding "right" walks a
 * straight line even while the camera swings round behind the character.
 * A manual look (drag) re-latches so the player can steer with the camera.
 */
export function updateMoveFrame(
  latched: number | null,
  intentMagnitude: number,
  cameraYaw: number,
  lookActive: boolean,
): number | null {
  if (intentMagnitude === 0) return null;
  if (latched === null || lookActive) return cameraYaw;
  return latched;
}

/** Frame-rate independent blend factor for an exponential approach. */
export function smoothingFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Converts a camera-space intent to a world XZ direction. A camera at yaw θ
 * sits behind the character at (+sin θ, +cos θ), so "forward" on the stick is
 * (−sin θ, −cos θ) and "right" is (cos θ, −sin θ).
 */
export function cameraRelativeDirection(
  intent: MoveIntent,
  cameraYaw: number,
): [number, number] {
  const fx = -Math.sin(cameraYaw);
  const fz = -Math.cos(cameraYaw);
  const rx = Math.cos(cameraYaw);
  const rz = -Math.sin(cameraYaw);
  return [fx * intent.y + rx * intent.x, fz * intent.y + rz * intent.x];
}

export function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export function animationForSpeed(
  speed: number,
  tuning: CharacterTuning,
): CharacterAnimationState {
  if (speed < 0.15) return "idle";
  if (speed > tuning.walkSpeed + 0.4) return "run";
  return "walk";
}

/**
 * Advances the character by `dt` seconds. Pure: returns a new state and never
 * touches Three.js. Collision resolution is applied separately afterwards.
 */
export function stepCharacter(
  state: CharacterState,
  intent: MoveIntent,
  cameraYaw: number,
  dt: number,
  tuning: CharacterTuning = DEFAULT_CHARACTER_TUNING,
): CharacterState {
  const [dirX, dirZ] = cameraRelativeDirection(intent, cameraYaw);
  const magnitude = Math.min(1, Math.hypot(dirX, dirZ));
  const maxSpeed = intent.run ? tuning.runSpeed : tuning.walkSpeed;
  const targetSpeed = magnitude * maxSpeed;
  const targetVx = magnitude > 0 ? (dirX / Math.hypot(dirX, dirZ)) * targetSpeed : 0;
  const targetVz = magnitude > 0 ? (dirZ / Math.hypot(dirX, dirZ)) * targetSpeed : 0;

  const accelerating = targetSpeed > state.speed;
  const blend = smoothingFactor(
    accelerating ? tuning.acceleration : tuning.deceleration,
    dt,
  );
  const vx = state.velocity[0] + (targetVx - state.velocity[0]) * blend;
  const vz = state.velocity[1] + (targetVz - state.velocity[1]) * blend;
  const speed = Math.hypot(vx, vz);

  let yaw = state.yaw;
  if (magnitude > 0) {
    const desiredYaw = yawFromDirection(dirX, dirZ);
    yaw = wrapAngle(
      yaw + shortestAngleDelta(yaw, desiredYaw) * smoothingFactor(tuning.turnSharpness, dt),
    );
  }

  return {
    position: [
      state.position[0] + vx * dt,
      state.position[1],
      state.position[2] + vz * dt,
    ],
    yaw,
    velocity: [vx, vz],
    speed,
    animation: animationForSpeed(speed, tuning),
  };
}
