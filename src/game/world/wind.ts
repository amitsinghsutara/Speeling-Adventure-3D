import type * as THREE from "three";

/**
 * Wind as a vertex-shader effect. Each patched material sways its vertices
 * sideways by an amount that grows with local height. The phase comes from
 * the instance position projected onto the wind direction, so a wave of
 * movement travels across the meadow in rhythm, with a small per-instance
 * jitter so nothing looks mechanical and a slower gust cycle riding on top.
 * It costs a few GPU instructions per vertex and no CPU work per frame,
 * which suits entry-level phones. Shadows keep the un-swayed shape (the
 * depth material is not patched) to stay cheap.
 */
export interface WindParams {
  /** Local-space y where the sway is zero (the anchor), e.g. a trunk's base. */
  readonly baseY: number;
  /** Local-space height over which the sway ramps to full. */
  readonly spanY: number;
  /** Maximum local-space displacement at full height. */
  readonly amplitude: number;
}

export interface WindUniforms {
  readonly uWindTime: { value: number };
  readonly uWindStrength: { value: number };
}

/** How fast the wind clock runs relative to real time (higher = brisker). */
export const WIND_SPEED = 1.8;
/** Direction the wave travels across the ground (unit vector, XZ). */
export const WIND_DIRECTION: readonly [number, number] = [0.8, 0.6];
/** Metres between successive wave crests. */
export const WIND_WAVELENGTH = 14;

/** One clock shared by every wind-patched material. */
export function createWindUniforms(): WindUniforms {
  return { uWindTime: { value: 0 }, uWindStrength: { value: 1 } };
}

/** Advances the wind clock; frozen (and calm) under reduced motion. */
export function advanceWind(uniforms: WindUniforms, delta: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    uniforms.uWindStrength.value = 0;
    return;
  }
  uniforms.uWindStrength.value = 1;
  uniforms.uWindTime.value += delta * WIND_SPEED;
}

const num = (v: number) => v.toFixed(4);

/** Injects the wind uniforms and displacement into a Three.js vertex shader. Pure. */
export function windShaderPatch(vertexShader: string, params: WindParams): string {
  const marker = "#include <begin_vertex>";
  if (!vertexShader.includes(marker)) return vertexShader;
  const k = (Math.PI * 2) / WIND_WAVELENGTH;
  const displacement = `${marker}
{
  vec3 windAnchor = vec3(0.0);
  #ifdef USE_INSTANCING
    windAnchor = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  // Travelling wave along the wind direction, plus a little per-plant jitter.
  float windAlong = windAnchor.x * ${num(WIND_DIRECTION[0])} + windAnchor.z * ${num(WIND_DIRECTION[1])};
  float windJitter = sin(windAnchor.x * 12.9 + windAnchor.z * 7.1) * 0.5;
  float windPhase = windAlong * ${num(k)} + windJitter;
  float windGust = 0.55 + 0.45 * sin(uWindTime * 0.5 - windAlong * ${num(k * 0.35)});
  float windHeight = clamp((position.y - ${num(params.baseY)}) / ${num(params.spanY)}, 0.0, 1.0);
  windHeight *= windHeight;
  float windSway = sin(uWindTime * 1.6 - windPhase) * ${num(params.amplitude)} * windGust * uWindStrength;
  transformed.x += windSway * windHeight * ${num(WIND_DIRECTION[0])};
  transformed.z += windSway * windHeight * ${num(WIND_DIRECTION[1])};
  transformed.x += windSway * 0.25 * windHeight * cos(uWindTime * 1.1 + windJitter * 3.0);
}`;
  return `uniform float uWindTime;\nuniform float uWindStrength;\n${vertexShader.replace(marker, displacement)}`;
}

/** Patches a built-in material so it sways in the wind. Call once per material. */
export function applyWind(material: THREE.Material, uniforms: WindUniforms, params: WindParams): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = windShaderPatch(shader.vertexShader, params);
  };
  material.customProgramCacheKey = () =>
    `wind:${params.baseY}:${params.spanY}:${params.amplitude}`;
}
