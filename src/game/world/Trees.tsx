"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import { CANOPY_COLORS, CONIFER_COLORS, type TreePlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface TreesProps {
  trees: readonly TreePlacement[];
}

/** Conifer tiers from bottom to top: [y offset in trunk heights, radius factor, height factor]. */
const CONIFER_TIERS: ReadonlyArray<readonly [number, number, number]> = [
  [0.55, 1.15, 1.35],
  [1.35, 0.9, 1.2],
  [2.05, 0.6, 1.05],
];

/**
 * All trees in five draw calls: one instanced trunk mesh, one instanced
 * round canopy, and three instanced cone tiers that together make every
 * conifer. Per-instance colour gives the variety; wind sway comes from the
 * shared materials.
 */
export function Trees({ trees }: TreesProps) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const canopies = useRef<THREE.InstancedMesh>(null);
  const tier0 = useRef<THREE.InstancedMesh>(null);
  const tier1 = useRef<THREE.InstancedMesh>(null);
  const tier2 = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();
  const round = useMemo(() => trees.filter((t) => t.kind === "round"), [trees]);
  const conifers = useMemo(() => trees.filter((t) => t.kind === "conifer"), [trees]);

  useLayoutEffect(() => {
    if (trunks.current) {
      writeInstances(trunks.current, trees, (tree, _i, out) => {
        const height = tree.kind === "conifer" ? tree.trunkHeight * 1.1 : tree.trunkHeight;
        out.position.set(tree.position[0], height / 2, tree.position[2]);
        out.scale.set(tree.kind === "conifer" ? 0.8 : 1, height, tree.kind === "conifer" ? 0.8 : 1);
        out.euler.set(tree.leanX, tree.rotationY, tree.leanZ);
        out.color.set("#ffffff");
      });
    }
    if (canopies.current) {
      writeInstances(canopies.current, round, (tree, _i, out) => {
        out.position.set(tree.position[0], tree.trunkHeight + tree.canopyRadius * 0.8, tree.position[2]);
        out.scale.set(tree.canopyRadius, tree.canopyRadius * 1.12, tree.canopyRadius);
        out.euler.set(tree.leanX, tree.rotationY, tree.leanZ);
        out.color.set(CANOPY_COLORS[tree.colorIndex] ?? CANOPY_COLORS[0]);
      });
    }
    [tier0, tier1, tier2].forEach((ref, tierIndex) => {
      const mesh = ref.current;
      const tier = CONIFER_TIERS[tierIndex];
      if (!mesh || !tier) return;
      const [yFactor, radiusFactor, heightFactor] = tier;
      writeInstances(mesh, conifers, (tree, _i, out) => {
        const s = tree.canopyRadius;
        const height = heightFactor * s;
        out.position.set(
          tree.position[0],
          tree.trunkHeight * 0.6 + yFactor * s + height / 2,
          tree.position[2],
        );
        out.scale.set(radiusFactor * s, height, radiusFactor * s);
        out.euler.set(tree.leanX, tree.rotationY, tree.leanZ);
        // Upper tiers are a touch lighter, like new growth.
        out.color.set(CONIFER_COLORS[tree.colorIndex] ?? CONIFER_COLORS[0]);
        out.color.offsetHSL(0, 0, tierIndex * 0.035);
      });
    });
  }, [trees, round, conifers]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, materials.trunk, trees.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 1, 7]} />
      </instancedMesh>
      <instancedMesh ref={canopies} args={[undefined, materials.canopy, round.length]} castShadow receiveShadow>
        <sphereGeometry args={[1, 9, 7]} />
      </instancedMesh>
      <instancedMesh ref={tier0} args={[undefined, materials.conifer, conifers.length]} castShadow receiveShadow>
        <coneGeometry args={[1, 1, 8]} />
      </instancedMesh>
      <instancedMesh ref={tier1} args={[undefined, materials.conifer, conifers.length]} castShadow receiveShadow>
        <coneGeometry args={[1, 1, 8]} />
      </instancedMesh>
      <instancedMesh ref={tier2} args={[undefined, materials.conifer, conifers.length]} castShadow receiveShadow>
        <coneGeometry args={[1, 1, 8]} />
      </instancedMesh>
    </group>
  );
}
