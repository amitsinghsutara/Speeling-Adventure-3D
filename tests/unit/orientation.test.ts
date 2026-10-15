import { describe, expect, it, vi } from "vitest";
import {
  enforceLandscape,
  isPortrait,
  lockScreenOrientation,
  requestContainerOrientation,
  watchOrientation,
} from "@/platform/orientation";

describe("requestContainerOrientation", () => {
  it("asks the container for landscape, keeping the bridge as `this`", () => {
    const android: Record<string, unknown> = {};
    const setContainerAppOrientation = vi.fn<(value: string) => void>(function (this: unknown) {
      expect(this).toBe(android);
    });
    android["setContainerAppOrientation"] = setContainerAppOrientation;
    expect(requestContainerOrientation("landscape", { Android: android })).toBe(true);
    expect(setContainerAppOrientation).toHaveBeenCalledWith("landscape");
  });

  it("does nothing in a browser or when the container has no such method, and never throws", () => {
    expect(requestContainerOrientation("landscape", {})).toBe(false);
    expect(requestContainerOrientation("landscape", undefined)).toBe(false);
    expect(requestContainerOrientation("landscape", { Android: { cachedStatus: () => {} } })).toBe(false);
    expect(
      requestContainerOrientation("landscape", {
        Android: {
          setContainerAppOrientation: () => {
            throw new Error("refused");
          },
        },
      }),
    ).toBe(false);
  });
});

describe("lockScreenOrientation / enforceLandscape", () => {
  it("reports a browser lock that succeeds, and one that is refused", async () => {
    const lock = vi.fn<(o: string) => Promise<void>>(async () => {});
    expect(await lockScreenOrientation("landscape", { screen: { orientation: { lock } } })).toBe(true);
    expect(lock).toHaveBeenCalledWith("landscape");
    const refused = vi.fn<(o: string) => Promise<void>>(() => Promise.reject(new Error("not fullscreen")));
    expect(await lockScreenOrientation("landscape", { screen: { orientation: { lock: refused } } })).toBe(false);
    expect(await lockScreenOrientation("landscape", {})).toBe(false);
  });

  it("tries the container and the browser lock together", async () => {
    const setContainerAppOrientation = vi.fn<(value: string) => void>();
    const lock = vi.fn<(o: string) => Promise<void>>(() => Promise.reject(new Error("no")));
    const result = await enforceLandscape({ Android: { setContainerAppOrientation }, screen: { orientation: { lock } } });
    expect(result).toEqual({ container: true, locked: false });
    expect(setContainerAppOrientation).toHaveBeenCalledWith("landscape");
  });
});

describe("isPortrait / watchOrientation", () => {
  it("uses the media query when available, else the viewport size", () => {
    expect(isPortrait({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isPortrait({ innerWidth: 400, innerHeight: 800 })).toBe(true);
    expect(isPortrait({ innerWidth: 800, innerHeight: 400 })).toBe(false);
    expect(isPortrait(undefined)).toBe(false);
  });

  it("watches the media query and stops cleanly", () => {
    const listeners = new Set<() => void>();
    const query = {
      matches: false,
      addEventListener: (_: "change", fn: () => void) => listeners.add(fn),
      removeEventListener: (_: "change", fn: () => void) => listeners.delete(fn),
    };
    const onChange = vi.fn<() => void>();
    const stop = watchOrientation(onChange, { matchMedia: () => query });
    listeners.forEach((l) => l());
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(listeners.size).toBe(0);
    expect(() => watchOrientation(onChange, {})()).not.toThrow();
  });
});
