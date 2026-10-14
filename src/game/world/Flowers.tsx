"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import { FLOWER_COLORS, type FlowerPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface FlowersProps {
  flowers: readonly FlowerPlacement[];
}

/** Colourful meadow flowers: instanced blossoms + instanced stems. */
export function Flowers({ flowers }: FlowersProps) {
  const blossoms = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    if (blossoms.current) {
      writeInstances(blossoms.current, flowers, (flower, _i, out) => {
        out.position.set(
          flower.position[0],
          0.34 * flower.scale,
          flower.position[2],
        );
        out.scale.setScalar(flower.scale);
        out.color.set(FLOWER_COLORS[flower.colorIndex] ?? FLOWER_COLORS[0]);
      });
    }
    if (stems.current) {
      writeInstances(stems.current, flowers, (flower, _i, out) => {
        out.position.set(
          flower.position[0],
          0.16 * flower.scale,
          flower.position[2],
        );
        out.scale.set(1, flower.scale, 1);
        out.color.set("#ffffff");
      });
    }
  }, [flowers]);

  return (
    <group>
      <instancedMesh
        ref={blossoms}
        args={[undefined, materials.flower, flowers.length]}
      >
        <sphereGeometry args={[0.15, 7, 5]} />
      </instancedMesh>
      <instancedMesh
        ref={stems}
        args={[undefined, materials.stem, flowers.length]}
      >
        <cylinderGeometry args={[0.03, 0.04, 0.32, 5]} />
      </instancedMesh>
    </group>
  );
}
