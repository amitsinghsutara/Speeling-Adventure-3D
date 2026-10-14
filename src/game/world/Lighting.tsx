"use client";

export interface LightingProps {
  shadows: boolean;
  shadowMapSize: number;
}

/**
 * Warm "animated movie" daylight: soft ambient + hemisphere fill and one
 * directional key light. Shadows are only enabled by the quality preset.
 */
export function Lighting({ shadows, shadowMapSize }: LightingProps) {
  return (
    <>
      <ambientLight intensity={0.45} color="#e6f4ff" />
      <hemisphereLight args={["#bfe6ff", "#5fb551", 0.8]} />
      <directionalLight
        position={[24, 36, 14]}
        intensity={2.4}
        color="#fff6dc"
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize || 1, shadowMapSize || 1]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  );
}
