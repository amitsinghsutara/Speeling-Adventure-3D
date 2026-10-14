"use client";

import { GROUND_RADIUS } from "./layout";
import { getSharedMaterials } from "./materials";

export function Ground() {
  const materials = getSharedMaterials();
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow material={materials.ground}>
      <circleGeometry args={[GROUND_RADIUS, 48]} />
    </mesh>
  );
}
