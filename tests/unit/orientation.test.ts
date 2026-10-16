import { describe, expect, it, vi } from "vitest";
import {
  describeAttempt,
  enforceLandscape,
  isPortrait,
  lockScreenOrientation,
  requestContainerOrientation,
  requestFullscreen,
  watchOrientation,
} from "@/platform/orientation";

describe("requestContainerOrientation", () => {
  it("asks the container for landscape, keeping the bridge as `this`", () => {
    const android: Record<string, unknown> = {};
    const setContainerAppOrientation = vi.fn<(value: string) => void>(function (this: unknown) {
      expect(this).toBe(android);
    });
    android["setContainerAppOrientation"] = setContainerAppOrientation;
    expect(requestContainerOrientation("landscape", { Android: android })).toEqual({ outcome: "ok" });
    expect(setContainerAppOrientation).toHaveBeenCalledWith("landscape");
  });

  it("reports when there is no container method, and a container that throws", () => {
    expect(requestContainerOrientation("landscape", {})).toEqual({ outcome: "unavailable" });
    expect(requestContainerOrientation("landscape", undefined)).toEqual({ outcome: "unavailable" });
    expect(requestContainerOrientation("landscape", { Android: { cachedStatus: () => {} } })).toEqual({ outcome: "unavailable" });
    expect(
      requestContainerOrientation("landscape", {
        Android: {
          setContainerAppOrientation: () => {
            throw new Error("refused");
          },
        },
      }),
    ).toEqual({ outcome: "refused", reason: "Error: refused" });
  });
});

describe("fullscreen and lock", () => {
  it("reports a browser lock that succeeds, one that is refused, and one that is missing", async () => {
    const lock = vi.fn<(o: string) => Promise<void>>(async () => {});
    expect(await lockScreenOrientation("landscape", { screen: { orientation: { lock } } })).toEqual({ outcome: "ok" });
    expect(lock).toHaveBeenCalledWith("landscape");
    const err = new Error("not fullscreen");
    err.name = "NotAllowedError";
    const refused = vi.fn<(o: string) => Promise<void>>(() => Promise.reject(err));
    expect(await lockScreenOrientation("landscape", { screen: { orientation: { lock: refused } } })).toEqual({
      outcome: "refused",
      reason: "NotAllowedError: not fullscreen",
    });
    expect(await lockScreenOrientation("landscape", {})).toEqual({ outcome: "unavailable" });
  });

  it("requests fullscreen on the document element, and skips it when already fullscreen", async () => {
    const request = vi.fn<() => Promise<void>>(async () => {});
    const doc = { fullscreenElement: null, documentElement: { requestFullscreen: request } };
    expect(await requestFullscreen({ document: doc })).toEqual({ outcome: "ok" });
    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
    expect(await requestFullscreen({ document: { fullscreenElement: {} as Element, documentElement: { requestFullscreen: request } } })).toEqual({ outcome: "ok" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(await requestFullscreen({ document: {} })).toEqual({ outcome: "unavailable" });
  });

  it("enforceLandscape tries the container, then fullscreen only when asked, then the lock", async () => {
    const setContainerAppOrientation = vi.fn<(value: string) => void>();
    const request = vi.fn<() => Promise<void>>(async () => {});
    const lock = vi.fn<(o: string) => Promise<void>>(() => Promise.reject(new Error("no")));
    const win = {
      Android: { setContainerAppOrientation },
      screen: { orientation: { lock } },
      document: { fullscreenElement: null, documentElement: { requestFullscreen: request } },
    };
    const start = await enforceLandscape(win, { now: () => 5 });
    expect(start).toEqual({
      container: { outcome: "ok" },
      fullscreen: { outcome: "unavailable" },
      lock: { outcome: "refused", reason: "Error: no" },
      trigger: "start",
      at: 5,
    });
    expect(request).not.toHaveBeenCalled();
    const tap = await enforceLandscape(win, { fullscreen: true, trigger: "tap", now: () => 6 });
    expect(tap.fullscreen).toEqual({ outcome: "ok" });
    expect(tap.trigger).toBe("tap");
    expect(setContainerAppOrientation).toHaveBeenCalledTimes(2);
  });

  it("describes attempts in plain words", () => {
    expect(describeAttempt({ outcome: "ok" })).toBe("yes");
    expect(describeAttempt({ outcome: "unavailable" })).toBe("not available here");
    expect(describeAttempt({ outcome: "refused", reason: "x" })).toBe("refused (x)");
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
