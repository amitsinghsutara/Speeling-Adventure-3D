"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { getSharedMaterials } from "./materials";
import type { Vec3 } from "./vec";

export type GateState = "locked" | "open";

export interface GateProps {
  position: Vec3;
  /** Faces the path: gates sit on the main path which runs along Z. */
  facing: "north" | "south";
  state: GateState;
  highlighted: boolean;
  reducedMotion: boolean;
}

/**
 * A wooden archway between scenes. Closed: a bar across and a dim marker.
 * Open: the bar is raised and the marker glows and spins.
 */
export function Gate({ position, facing, state, highlighted, reducedMotion }: GateProps) {
  const m = getSharedMaterials();
  const marker = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (marker.current) {
      marker.current.position.y = 3.6 + (reducedMotion ? 0 : Math.sin(t * 2.2) * 0.12);
      marker.current.scale.setScalar(highlighted ? 1.4 : 1);
      if (!reducedMotion && state === "open") marker.current.rotation.y = t * 1.6;
    }
    if (bar.current) {
      const target = state === "open" ? 2.6 : 1.1;
      bar.current.position.y += (target - bar.current.position.y) * (reducedMotion ? 1 : 0.08);
    }
  });

  const yaw = facing === "north" ? 0 : Math.PI;
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={yaw}>
      {[-1.6, 1.6].map((x) => (
        <mesh key={x} material={m.signWood} castShadow position={[x, 1.6, 0]}>
          <cylinderGeometry args={[0.22, 0.28, 3.2, 7]} />
        </mesh>
      ))}
      <mesh material={m.signBoard} castShadow position={[0, 3.2, 0]}>
        <boxGeometry args={[3.9, 0.45, 0.4]} />
      </mesh>
      <mesh ref={bar} material={state === "open" ? m.signBoard : m.foxDark} castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[3.3, 0.22, 0.22]} />
      </mesh>
      <group ref={marker} position={[0, 3.6, 0]}>
        <mesh material={state === "open" ? m.markerActive : m.markerLocked}>
          <octahedronGeometry args={[0.3, 0]} />
        </mesh>
      </group>
    </group>
  );
}
