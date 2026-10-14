export type WebGLSupport =
  | { supported: true; version: 1 | 2 }
  | { supported: false; reason: string };

/** Minimal structural type so the check can be unit-tested without a browser. */
export interface CanvasFactory {
  createElement(tag: "canvas"): {
    getContext(contextId: string): unknown;
  };
}

/**
 * Probes for a usable WebGL context *before* the renderer is mounted so the
 * shell can show a friendly message instead of a crash. The probe context is
 * released immediately where the browser allows it. Pass `null` to represent
 * an environment with no document (server rendering).
 */
export function describeWebGLSupport(
  doc: CanvasFactory | null = typeof document === "undefined" ? null : document,
): WebGLSupport {
  if (!doc) {
    return {
      supported: false,
      reason: "No document available (server environment).",
    };
  }
  try {
    const canvas = doc.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 ?? canvas.getContext("webgl");
    if (!gl || typeof gl !== "object") {
      return {
        supported: false,
        reason: "The browser could not create a WebGL context.",
      };
    }
    releaseContext(gl);
    return { supported: true, version: gl2 ? 2 : 1 };
  } catch (error) {
    return {
      supported: false,
      reason:
        error instanceof Error
          ? `WebGL probe failed: ${error.message}`
          : "WebGL probe failed.",
    };
  }
}

function releaseContext(gl: object): void {
  const maybe = gl as { getExtension?: (name: string) => unknown };
  if (typeof maybe.getExtension !== "function") return;
  const ext = maybe.getExtension("WEBGL_lose_context") as
    | { loseContext?: () => void }
    | null;
  ext?.loseContext?.();
}
