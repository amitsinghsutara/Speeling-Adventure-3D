"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getSharedMaterials } from "./materials";
import { buildRibbonGeometry } from "./path";
import type { Vec3 } from "./vec";

export interface PathRibbonProps {
  points: readonly Vec3[];
  width: number;
}

export function PathRibbon({ points, width }: PathRibbonProps) {
  const materials = getSharedMaterials();
  const geometry = useMemo(() => {
    const data = buildRibbonGeometry(points, width);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(data.positions, 3),
    );
    geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [points, width]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh geometry={geometry} material={materials.path} receiveShadow />;
}
