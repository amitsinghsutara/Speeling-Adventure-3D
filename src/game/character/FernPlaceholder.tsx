"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { getSharedMaterials } from "@/game/world/materials";
import type { CharacterVisualProps } from "./types";

/**
 * Placeholder Fern built from primitives: orange body, cream muzzle and chest,
 * dark socks, bushy tail with a cream tip. It implements the same
 * CharacterVisualProps the rigged GLB will, so the controller never changes
 * when the real model arrives. Faces −Z at yaw 0.
 */
export function FernPlaceholder({
  position,
  yaw,
  animation,
  reducedMotion,
}: CharacterVisualProps) {
  const group = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const m = getSharedMaterials();

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || reducedMotion) return;
    const t = clock.elapsedTime;
    const bobSpeed = animation === "run" ? 11 : animation === "walk" ? 7 : 2.2;
    const bobAmp = animation === "idle" ? 0.02 : 0.06;
    g.position.y = position[1] + Math.abs(Math.sin(t * bobSpeed)) * bobAmp;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(t * 2.6) * 0.28;
    }
  });

  return (
    <group
      ref={group}
      position={[position[0], position[1], position[2]]}
      rotation-y={yaw}
    >
      {/* Body */}
      <mesh
        material={m.foxOrange}
        castShadow
        position={[0, 0.58, 0]}
        rotation-x={Math.PI / 2}
      >
        <capsuleGeometry args={[0.3, 0.55, 4, 10]} />
      </mesh>
      {/* Chest */}
      <mesh material={m.foxCream} position={[0, 0.5, -0.32]}>
        <sphereGeometry args={[0.24, 10, 8]} />
      </mesh>
      {/* Head */}
      <mesh material={m.foxOrange} castShadow position={[0, 0.98, -0.52]}>
        <sphereGeometry args={[0.3, 12, 10]} />
      </mesh>
      {/* Muzzle */}
      <mesh material={m.foxCream} position={[0, 0.88, -0.76]}>
        <sphereGeometry args={[0.15, 10, 8]} />
      </mesh>
      {/* Nose */}
      <mesh material={m.foxDark} position={[0, 0.92, -0.9]}>
        <sphereGeometry args={[0.06, 8, 6]} />
      </mesh>
      {/* Eyes */}
      <mesh material={m.foxDark} position={[-0.12, 1.06, -0.76]}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      <mesh material={m.foxDark} position={[0.12, 1.06, -0.76]}>
        <sphereGeometry args={[0.05, 8, 6]} />
      </mesh>
      {/* Ears */}
      <mesh material={m.foxOrange} position={[-0.17, 1.32, -0.48]}>
        <coneGeometry args={[0.11, 0.32, 6]} />
      </mesh>
      <mesh material={m.foxOrange} position={[0.17, 1.32, -0.48]}>
        <coneGeometry args={[0.11, 0.32, 6]} />
      </mesh>
      {/* Legs (dark socks) */}
      {[
        [-0.18, -0.28],
        [0.18, -0.28],
        [-0.18, 0.28],
        [0.18, 0.28],
      ].map(([x, z], i) => (
        <mesh key={i} material={m.foxDark} position={[x ?? 0, 0.22, z ?? 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.44, 6]} />
        </mesh>
      ))}
      {/* Tail */}
      <group ref={tail} position={[0, 0.58, 0.42]} rotation-x={0.95}>
        <mesh material={m.foxOrange} castShadow position={[0, 0.3, 0]}>
          <capsuleGeometry args={[0.14, 0.42, 4, 8]} />
        </mesh>
        <mesh material={m.foxCream} position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.14, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}
