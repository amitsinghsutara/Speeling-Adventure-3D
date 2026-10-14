import type * as THREE from "three";

/**
 * Wind as a vertex-shader effect. Each patched material sways its vertices
 * sideways by an amount that grows with local height, with a phase taken
 * from the instance position so every tree and flower moves differently and
 * a slow gust cycle on top. It costs a few GPU instructions per vertex and no
 * CPU work per frame, which suits entry-level phones. Shadows keep the
 * un-swayed shape (the depth material is not patched) to stay cheap.
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
  uniforms.uWindTime.value += delta;
}

const num = (v: number) => v.toFixed(4);

/** Injects the wind uniforms and displacement into a Three.js vertex shader. Pure. */
export function windShaderPatch(vertexShader: string, params: WindParams): string {
  const marker = "#include <begin_vertex>";
  if (!vertexShader.includes(marker)) return vertexShader;
  const displacement = `${marker}
{
  vec3 windAnchor = vec3(0.0);
  #ifdef USE_INSTANCING
    windAnchor = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  float windPhase = windAnchor.x * 0.35 + windAnchor.z * 0.27;
  float windGust = 0.6 + 0.4 * sin(uWindTime * 0.37 + windPhase * 0.5);
  float windHeight = clamp((position.y - ${num(params.baseY)}) / ${num(params.spanY)}, 0.0, 1.0);
  windHeight *= windHeight;
  float windSway = sin(uWindTime * 1.4 + windPhase) * ${num(params.amplitude)} * windGust * uWindStrength;
  transformed.x += windSway * windHeight;
  transformed.z += windSway * 0.35 * windHeight * cos(uWindTime * 0.9 + windPhase);
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
