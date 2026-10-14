import type { Vec3 } from "@/game/world/vec";

/**
 * Animation states the character controller will drive. The placeholder and
 * the eventual rigged GLB both consume the same props, so the controller never
 * depends on which visual is mounted.
 */
export type CharacterAnimationState = "idle" | "walk" | "run";

export interface CharacterVisualProps {
  readonly position: Vec3;
  /** Rotation about Y in radians; 0 faces −Z. */
  readonly yaw: number;
  readonly animation: CharacterAnimationState;
  readonly reducedMotion: boolean;
}
