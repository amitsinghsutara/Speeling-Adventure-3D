import { describe, expect, it, vi } from "vitest";
import { createOfflineController } from "@/offline/serviceWorkerClient";

/**
 * A fake service worker that answers the page's messages the way
 * src/sw/worker.js does: `get-version` → its build, `precache` → a result.
 */
function fakeWorker(version: string) {
  return {
    state: "activated",
    scriptURL: "https://app.test/sw.js",
    postMessage(message: { type: string; urls?: string[] }, transfer?: Transferable[]) {
      const port = transfer?.[0] as MessagePort | undefined;
      const reply = (data: unknown) => port?.postMessage(data);
      if (message.type === "get-version") reply({ type: "version", version });
      if (message.type === "precache") reply({ type: "precache-result", version, ok: true, cached: message.urls?.length ?? 0, failed: [] });
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

function fakeWindow(options: { controller: boolean; activeVersion: string }) {
  const active = fakeWorker(options.activeVersion);
  const registration = { active, installing: null, waiting: null, update: async () => {} };
  const container = {
    controller: options.controller ? fakeWorker("old") : null,
    ready: Promise.resolve(registration),
    register: vi.fn(async () => registration),
    addEventListener() {},
  };
  const listeners = new Map<string, () => void>();
  const win = {
    navigator: { onLine: true, serviceWorker: container },
    isSecureContext: true,
    location: { search: "?sw=1", origin: "https://app.test", reload: vi.fn() },
    performance: { getEntriesByType: () => [] },
    document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener() {},
    setInterval: () => 0,
    clearInterval() {},
  } as unknown as Window;
  return { win, container, registration };
}

describe("createOfflineController start-up", () => {
  it("flags an update when a newer worker already controls a stale page", async () => {
    const { win } = fakeWindow({ controller: true, activeVersion: "build-2" });
    const controller = createOfflineController(win, { buildId: "build-1" });
    const status = await controller.start();
    expect(status.phase).toBe("ready");
    expect(status.version).toBe("build-2");
    expect(status.updateReady).toBe(true);
  });

  it("stays quiet when the active worker is this page's own build", async () => {
    const { win } = fakeWindow({ controller: true, activeVersion: "build-1" });
    const controller = createOfflineController(win, { buildId: "build-1" });
    const status = await controller.start();
    expect(status.phase).toBe("ready");
    expect(status.updateReady).toBe(false);
  });

  it("never flags an update on a first visit (no previous controller)", async () => {
    const { win, container } = fakeWindow({ controller: false, activeVersion: "build-2" });
    const controller = createOfflineController(win, { buildId: "build-1" });
    const status = await controller.start();
    expect(status.updateReady).toBe(false);
    expect(container.register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });
});
