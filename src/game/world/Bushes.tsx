"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import type { BushPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface BushesProps {
  bushes: readonly BushPlacement[];
  colors: readonly string[];
}

/** Low undergrowth: one instanced, squashed low-poly sphere. */
export function Bushes({ bushes, colors }: BushesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeInstances(mesh, bushes, (bush, _i, out) => {
      out.position.set(bush.position[0], bush.scale * 0.45, bush.position[2]);
      out.scale.set(bush.scale * 1.2, bush.scale * 0.8, bush.scale);
      out.euler.set(0, bush.rotationY, 0);
      out.color.set(colors[bush.colorIndex] ?? colors[0] ?? "#4aa848");
    });
  }, [bushes, colors]);

  return (
    <instancedMesh ref={ref} args={[undefined, materials.bush, bushes.length]} castShadow receiveShadow>
      <sphereGeometry args={[1, 7, 5]} />
    </instancedMesh>
  );
}
