"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { getSharedMaterials } from "@/game/world/materials";
import type { CharacterVisualProps } from "./types";

const LEG_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-0.18, -0.28],
  [0.18, -0.28],
  [-0.18, 0.28],
  [0.18, 0.28],
];

/**
 * Placeholder Fern built from primitives: orange body, cream muzzle and chest,
 * dark socks, bushy tail with a cream tip. Faces −Z. The outer group is
 * positioned by the rig; this component only animates the inner body group.
 */
export function FernPlaceholder({
  ref,
  animation,
  reducedMotion,
}: CharacterVisualProps) {
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const m = getSharedMaterials();

  useFrame(({ clock }) => {
    const b = body.current;
    if (!b || reducedMotion) return;
    const t = clock.elapsedTime;
    const moving = animation !== "idle";
    const stride = animation === "run" ? 13 : 8;
    const bobAmp = animation === "run" ? 0.07 : animation === "walk" ? 0.045 : 0.015;
    b.position.y = moving
      ? Math.abs(Math.sin(t * stride)) * bobAmp
      : Math.sin(t * 2.2) * bobAmp;
    b.rotation.x = moving ? Math.sin(t * stride) * 0.03 : 0;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(t * (moving ? 6 : 2.6)) * 0.3;
    }
    const legAmp = animation === "run" ? 0.75 : animation === "walk" ? 0.45 : 0;
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      leg.rotation.x = moving ? Math.sin(t * stride + phase) * legAmp : 0;
    });
  });

  return (
    <group ref={ref}>
      <group ref={body}>
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
      {/* Legs pivot at the hip so they swing rather than slide. */}
      {LEG_OFFSETS.map(([x, z], i) => (
        <group
          key={i}
          ref={(el) => {
            legs.current[i] = el;
          }}
          position={[x, 0.44, z]}
        >
          <mesh material={m.foxDark} position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.44, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
