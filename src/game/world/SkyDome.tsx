"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

const VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition).y;
    float f = pow(max(h, 0.0), exponent);
    gl_FragColor = vec4(mix(horizonColor, topColor, f), 1.0);
    #include <colorspace_fragment>
  }
`;

export interface SkyDomeProps {
  radius?: number;
  topColor?: string;
  horizonColor?: string;
}

/**
 * Cheap two-colour gradient sky: one inverted sphere, one tiny shader,
 * no textures. Far cheaper than a physically based sky on low-end phones.
 */
export function SkyDome({
  radius = 260,
  topColor = "#4fa8ef",
  horizonColor = "#d4f0ff",
}: SkyDomeProps) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(topColor) },
          horizonColor: { value: new THREE.Color(horizonColor) },
          exponent: { value: 0.55 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [topColor, horizonColor],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[radius, 24, 12]} />
    </mesh>
  );
}
