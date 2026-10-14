"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { writeInstances } from "./instancing";
import type { RockPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface RocksProps {
  rocks: readonly RockPlacement[];
}

export function Rocks({ rocks }: RocksProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    writeInstances(mesh, rocks, (rock, i, out) => {
      out.position.set(rock.position[0], rock.scale * 0.35, rock.position[2]);
      out.scale.set(rock.scale * 1.1, rock.scale * 0.75, rock.scale);
      out.euler.set((i % 3) * 0.12, rock.rotationY, (i % 2) * 0.1);
      out.color.set("#ffffff");
    });
  }, [rocks]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, materials.rock, rocks.length]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[0.7, 0]} />
    </instancedMesh>
  );
}
