// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

const probe = vi.hoisted(() => ({ canvasModuleLoaded: false }));

vi.mock("@/game/GameCanvas", () => {
  probe.canvasModuleLoaded = true;
  return { GameCanvas: () => null };
});

describe("HomePage server rendering", () => {
  it("renders the loading shell without touching the 3D module", () => {
    const html = renderToString(<HomePage />);
    expect(html).toContain("Spelling Adventure 3D");
    expect(html).toContain("Waking up the meadow");
    expect(html).toContain('role="status"');
    // `ssr: false` must keep Three.js / WebGL entirely off the server.
    expect(probe.canvasModuleLoaded).toBe(false);
    expect(typeof WebGLRenderingContext).toBe("undefined");
  });
});
