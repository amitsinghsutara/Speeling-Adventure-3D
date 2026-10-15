"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { getSharedMaterials } from "./materials";
import type { Vec3 } from "./vec";

export type SignState = "locked" | "available" | "completed";

export interface SignpostProps {
  position: Vec3;
  /** True while Fern is in range: the marker brightens and grows. */
  highlighted: boolean;
  state: SignState;
  reducedMotion: boolean;
}

/**
 * Warm wooden signpost with a floating marker as the interaction affordance.
 * The marker colour says the puzzle's state: grey locked, yellow available,
 * green done (shape and bob change too, never colour alone).
 */
export function Signpost({ position, highlighted, state, reducedMotion }: SignpostProps) {
  const m = getSharedMaterials();
  const marker = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = marker.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const bob = reducedMotion || state === "locked" ? 0 : Math.sin(t * 2.4) * 0.12;
    g.position.y = 2.35 + bob;
    g.scale.setScalar(highlighted ? 1.35 : 1);
    if (!reducedMotion && state !== "locked") g.rotation.y = t * 1.2;
  });

  const markerMaterial =
    state === "completed" ? m.markerDone : state === "locked" ? m.markerLocked : highlighted ? m.markerActive : m.marker;

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={0.35}>
      <mesh material={m.signWood} castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 1.6, 7]} />
      </mesh>
      <mesh material={m.signBoard} castShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[1.3, 0.55, 0.1]} />
      </mesh>
      <mesh material={m.signBoard} castShadow position={[0.78, 1.45, 0]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.39, 0.39, 0.1]} />
      </mesh>
      <group ref={marker} position={[0, 2.35, 0]}>
        <mesh material={markerMaterial}>
          {state === "completed" ? <sphereGeometry args={[0.24, 10, 8]} /> : <octahedronGeometry args={[0.22, 0]} />}
        </mesh>
      </group>
    </group>
  );
}
