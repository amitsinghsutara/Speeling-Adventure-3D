"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import type { GrassPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface GrassProps {
  tufts: readonly GrassPlacement[];
  colors: readonly string[];
}

/** Angular sectors × radial rings; each chunk gets its own bounding sphere so off-screen grass is culled. */
const SECTORS = 12;
const RINGS = 3;
const RING_RADIUS = 60;

function chunkIndex(x: number, z: number): number {
  const angle = Math.atan2(z, x) + Math.PI;
  const sector = Math.min(SECTORS - 1, Math.floor((angle / (Math.PI * 2)) * SECTORS));
  const ring = Math.min(RINGS - 1, Math.floor((Math.hypot(x, z) / RING_RADIUS) * RINGS));
  return ring * SECTORS + sector;
}

/**
 * Dense, short lawn grass. Tufts are tiny three-sided cones, drawn as a few
 * dozen instanced chunks so the camera frustum culls what it cannot see.
 */
export function Grass({ tufts, colors }: GrassProps) {
  const chunks = useMemo(() => {
    const buckets: GrassPlacement[][] = Array.from({ length: SECTORS * RINGS }, () => []);
    for (const tuft of tufts) buckets[chunkIndex(tuft.position[0], tuft.position[2])]?.push(tuft);
    return buckets.filter((b) => b.length > 0);
  }, [tufts]);
  return (
    <group>
      {chunks.map((chunk, i) => (
        <GrassChunk key={i} tufts={chunk} colors={colors} />
      ))}
    </group>
  );
}

function GrassChunk({ tufts, colors }: GrassProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeInstances(mesh, tufts, (tuft, _i, out) => {
      out.position.set(tuft.position[0], 0.13 * tuft.scale, tuft.position[2]);
      out.scale.set(tuft.scale, tuft.scale, tuft.scale);
      out.euler.set(0, tuft.rotationY, 0);
      out.color.set(colors[tuft.colorIndex] ?? colors[0] ?? "#6fcf5f");
    });
  }, [tufts, colors]);
  return (
    <instancedMesh ref={ref} args={[undefined, materials.grass, tufts.length]} receiveShadow>
      <coneGeometry args={[0.09, 0.26, 3]} />
    </instancedMesh>
  );
}
