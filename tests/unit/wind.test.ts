import { describe, expect, it } from "vitest";
import { advanceWind, applyWind, createWindUniforms, windShaderPatch } from "@/game/world/wind";

const PARAMS = { baseY: -0.5, spanY: 1, amplitude: 0.05 };
const SHADER = "void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}";

describe("windShaderPatch", () => {
  it("adds the uniforms and a height-weighted sway after begin_vertex", () => {
    const patched = windShaderPatch(SHADER, PARAMS);
    expect(patched.startsWith("uniform float uWindTime;\nuniform float uWindStrength;\n")).toBe(true);
    expect(patched).toContain("#include <begin_vertex>");
    expect(patched).toContain("transformed.x += windSway * windHeight;");
    expect(patched).toContain("(position.y - -0.5000) / 1.0000");
    expect(patched).toContain("* 0.0500 * windGust * uWindStrength");
    expect(patched).toContain("#ifdef USE_INSTANCING");
    expect(patched.indexOf("windSway")).toBeGreaterThan(patched.indexOf("#include <begin_vertex>"));
    expect(patched.indexOf("windSway")).toBeLessThan(patched.indexOf("#include <project_vertex>"));
  });

  it("leaves shaders without the marker untouched", () => {
    expect(windShaderPatch("void main() {}", PARAMS)).toBe("void main() {}");
  });
});

describe("wind clock", () => {
  it("advances time with motion and freezes calm under reduced motion", () => {
    const uniforms = createWindUniforms();
    advanceWind(uniforms, 0.016, false);
    advanceWind(uniforms, 0.016, false);
    expect(uniforms.uWindTime.value).toBeCloseTo(0.032);
    expect(uniforms.uWindStrength.value).toBe(1);
    advanceWind(uniforms, 1, true);
    expect(uniforms.uWindTime.value).toBeCloseTo(0.032);
    expect(uniforms.uWindStrength.value).toBe(0);
  });
});

describe("applyWind", () => {
  it("installs a compile hook that shares the uniforms and a distinct cache key", () => {
    const uniforms = createWindUniforms();
    const material = { onBeforeCompile: undefined, customProgramCacheKey: undefined } as unknown as import("three").Material;
    applyWind(material, uniforms, PARAMS);
    const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: SHADER, fragmentShader: "" };
    material.onBeforeCompile(shader as never, {} as never);
    expect(shader.uniforms.uWindTime).toBe(uniforms.uWindTime);
    expect(shader.vertexShader).toContain("windSway");
    expect(material.customProgramCacheKey()).toBe("wind:-0.5:1:0.05");
  });
});
