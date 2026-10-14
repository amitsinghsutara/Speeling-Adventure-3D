"use client";

import { useFrame } from "@react-three/fiber";
import { getDebugSnapshot } from "@/game/debug";
import { getSharedMaterials } from "./materials";
import { advanceWind } from "./wind";

export interface WindProps {
  reducedMotion: boolean;
}

/** Drives the shared wind clock; mutates a uniform, never React state. */
export function WindDriver({ reducedMotion }: WindProps) {
  const { wind } = getSharedMaterials();
  useFrame((_state, delta) => {
    advanceWind(wind, Math.min(delta, 0.1), reducedMotion);
    const debug = getDebugSnapshot();
    if (debug) debug.windTime = wind.uWindTime.value;
  });
  return null;
}
