import type { Ref } from "react";
import type { Group } from "three";

/**
 * Animation states the character controller drives. The placeholder and the
 * eventual rigged GLB both consume the same props, so the controller never
 * depends on which visual is mounted.
 */
export type CharacterAnimationState = "idle" | "walk" | "run";

export interface CharacterVisualProps {
  /**
   * The rig owns this group's position and yaw and updates them every frame.
   * The visual must only animate its own children (bob, legs, tail).
   */
  readonly ref?: Ref<Group>;
  readonly animation: CharacterAnimationState;
  readonly reducedMotion: boolean;
}
