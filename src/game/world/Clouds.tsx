"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import type { CloudPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface CloudsProps {
  clouds: readonly CloudPlacement[];
  reducedMotion: boolean;
}

/** Three overlapping puffs per cloud, as a single instanced sphere mesh. */
const PUFFS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 1],
  [1.15, -0.12, 0.15, 0.78],
  [-1.05, -0.18, -0.1, 0.7],
];

export function Clouds({ clouds, reducedMotion }: CloudsProps) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  const puffs = useMemo(
    () => clouds.flatMap((cloud) => PUFFS.map((puff) => ({ cloud, puff }))),
    [clouds],
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    writeInstances(mesh.current, puffs, ({ cloud, puff }, _i, out) => {
      out.position.set(
        cloud.position[0] + puff[0] * cloud.scale,
        cloud.position[1] + puff[1] * cloud.scale,
        cloud.position[2] + puff[2] * cloud.scale,
      );
      out.scale.set(
        cloud.scale * puff[3],
        cloud.scale * puff[3] * 0.62,
        cloud.scale * puff[3],
      );
      out.color.set("#ffffff");
    });
  }, [puffs]);

  useFrame((_state, delta) => {
    if (reducedMotion || !group.current) return;
    // Slow drift around the meadow; mutates the Three object, no React state.
    group.current.rotation.y += delta * 0.006;
  });

  return (
    <group ref={group}>
      <instancedMesh
        ref={mesh}
        args={[undefined, materials.cloud, puffs.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
    </group>
  );
}
