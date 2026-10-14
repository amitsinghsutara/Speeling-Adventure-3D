"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import { CANOPY_COLORS, type TreePlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface TreesProps {
  trees: readonly TreePlacement[];
}

/** Cartoon trees: instanced trunks + instanced round canopies (2 draw calls). */
export function Trees({ trees }: TreesProps) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopies = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    if (trunks.current) {
      writeInstances(trunks.current, trees, (tree, _i, out) => {
        out.position.set(
          tree.position[0],
          tree.trunkHeight / 2,
          tree.position[2],
        );
        out.scale.set(1, tree.trunkHeight, 1);
        out.euler.set(0, tree.rotationY, 0);
        out.color.set("#ffffff");
      });
    }
    if (canopies.current) {
      writeInstances(canopies.current, trees, (tree, _i, out) => {
        out.position.set(
          tree.position[0],
          tree.trunkHeight + tree.canopyRadius * 0.8,
          tree.position[2],
        );
        out.scale.set(
          tree.canopyRadius,
          tree.canopyRadius * 1.12,
          tree.canopyRadius,
        );
        out.euler.set(0, tree.rotationY, 0);
        out.color.set(CANOPY_COLORS[tree.colorIndex] ?? CANOPY_COLORS[0]);
      });
    }
  }, [trees]);

  return (
    <group>
      <instancedMesh
        ref={trunks}
        args={[undefined, materials.trunk, trees.length]}
        castShadow
      >
        <cylinderGeometry args={[0.16, 0.26, 1, 7]} />
      </instancedMesh>
      <instancedMesh
        ref={canopies}
        args={[undefined, materials.canopy, trees.length]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 9, 7]} />
      </instancedMesh>
    </group>
  );
}
