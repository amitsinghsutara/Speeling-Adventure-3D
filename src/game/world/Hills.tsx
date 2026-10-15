"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import type { HillPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface HillsProps {
  hills: readonly HillPlacement[];
  colors: readonly string[];
}

/** Rolling hills as one instanced, flat-shaded low-poly sphere. */
export function Hills({ hills, colors }: HillsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeInstances(mesh, hills, (hill, _i, out) => {
      out.position.set(hill.position[0], -0.4, hill.position[2]);
      out.scale.set(hill.radiusX, hill.height, hill.radiusZ);
      out.color.set(colors[hill.colorIndex] ?? colors[0] ?? "#5cbf4f");
    });
  }, [hills, colors]);

  return (
    <instancedMesh ref={ref} args={[undefined, materials.hill, hills.length]} receiveShadow>
      <sphereGeometry args={[1, 14, 9]} />
    </instancedMesh>
  );
}
