import type { CharacterAnimationState } from "./character/types";

/**
 * Development-only snapshot of the player state, exposed on
 * `window.__spellingAdventureDebug` so browser automation and on-device
 * profiling can read positions and speeds without touching React internals.
 * Stripped from production builds by the NODE_ENV check.
 */
export interface DebugSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  animation: CharacterAnimationState;
  cameraYaw: number;
  frames: number;
  /** Shared wind clock in seconds (0 and frozen under reduced motion). */
  windTime: number;
}

declare global {
  interface Window {
    __spellingAdventureDebug?: DebugSnapshot;
  }
}

const ENABLED = process.env.NODE_ENV !== "production";

export function getDebugSnapshot(): DebugSnapshot | null {
  if (!ENABLED || typeof window === "undefined") return null;
  if (!window.__spellingAdventureDebug) {
    window.__spellingAdventureDebug = {
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      animation: "idle",
      cameraYaw: 0,
      frames: 0,
      windTime: 0,
    };
  }
  return window.__spellingAdventureDebug;
}
