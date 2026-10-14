import { describe, expect, it, vi } from "vitest";
import { RendererError, toRendererErrorInfo } from "@/game/graphics/errors";
import { describeWebGLSupport } from "@/game/graphics/webgl";

function fakeDocument(getContext: (id: string) => unknown) {
  return { createElement: () => ({ getContext }) };
}

describe("describeWebGLSupport", () => {
  it("reports unsupported when no document exists (server)", () => {
    const result = describeWebGLSupport(null);
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toMatch(/server/i);
  });

  it("reports unsupported when no context can be created", () => {
    const result = describeWebGLSupport(fakeDocument(() => null));
    expect(result).toEqual({
      supported: false,
      reason: expect.stringMatching(/WebGL context/),
    });
  });

  it("prefers WebGL2 and releases the probe context", () => {
    const loseContext = vi.fn();
    const context = {
      getExtension: (name: string) =>
        name === "WEBGL_lose_context" ? { loseContext } : null,
    };
    const result = describeWebGLSupport(
      fakeDocument((id) => (id === "webgl2" ? context : null)),
    );
    expect(result).toEqual({ supported: true, version: 2 });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("falls back to WebGL1", () => {
    const result = describeWebGLSupport(
      fakeDocument((id) => (id === "webgl" ? {} : null)),
    );
    expect(result).toEqual({ supported: true, version: 1 });
  });

  it("treats a throwing probe as unsupported", () => {
    const result = describeWebGLSupport(
      fakeDocument(() => {
        throw new Error("blocked by policy");
      }),
    );
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toContain("blocked by policy");
  });
});

describe("toRendererErrorInfo", () => {
  it("maps typed renderer errors to friendly copy and keeps the detail", () => {
    const info = toRendererErrorInfo(
      new RendererError("context-lost", "webglcontextlost"),
    );
    expect(info.code).toBe("context-lost");
    expect(info.title).toMatch(/nap/);
    expect(info.detail).toBe("webglcontextlost");
  });

  it("treats unknown failures as initialisation errors", () => {
    expect(toRendererErrorInfo(new TypeError("boom")).detail).toBe(
      "TypeError: boom",
    );
    expect(toRendererErrorInfo("plain string").detail).toBe("plain string");
    expect(toRendererErrorInfo(42).code).toBe("init-failed");
  });
});
