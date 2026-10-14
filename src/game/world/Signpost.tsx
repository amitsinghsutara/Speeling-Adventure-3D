"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { getSharedMaterials } from "./materials";
import type { Vec3 } from "./vec";

export interface SignpostProps {
  position: Vec3;
  /** True while Fern is in range: the marker brightens and grows. */
  highlighted: boolean;
  reducedMotion: boolean;
}

/** Warm wooden signpost with a floating marker as the interaction affordance. */
export function Signpost({ position, highlighted, reducedMotion }: SignpostProps) {
  const m = getSharedMaterials();
  const marker = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = marker.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const bob = reducedMotion ? 0 : Math.sin(t * 2.4) * 0.12;
    g.position.y = 2.35 + bob;
    const scale = highlighted ? 1.35 : 1;
    g.scale.setScalar(scale);
    if (!reducedMotion) g.rotation.y = t * 1.2;
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={0.35}>
      {/* Post */}
      <mesh material={m.signWood} castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 1.6, 7]} />
      </mesh>
      {/* Board */}
      <mesh material={m.signBoard} castShadow position={[0, 1.45, 0]}>
        <boxGeometry args={[1.3, 0.55, 0.1]} />
      </mesh>
      {/* Arrow tip on the board */}
      <mesh
        material={m.signBoard}
        castShadow
        position={[0.78, 1.45, 0]}
        rotation-z={Math.PI / 4}
      >
        <boxGeometry args={[0.39, 0.39, 0.1]} />
      </mesh>
      {/* Marker */}
      <group ref={marker} position={[0, 2.35, 0]}>
        <mesh material={highlighted ? m.markerActive : m.marker}>
          <octahedronGeometry args={[0.22, 0]} />
        </mesh>
      </group>
    </group>
  );
}
