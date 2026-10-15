import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectPrecacheUrls } from "@/offline/serviceWorkerClient";
import { checkRegistration, scheduleUpdateChecks, type RegistrationLike } from "@/offline/updates";
import {
  EXIT_METHOD_CANDIDATES,
  describeContainer,
  detectExitBridge,
  notifyContainerCached,
} from "@/platform/containerBridge";

describe("detectExitBridge", () => {
  it("cannot exit in a normal browser", () => {
    expect(detectExitBridge({}).canExit).toBe(false);
    expect(detectExitBridge(undefined).canExit).toBe(false);
  });

  it("cannot exit when the container bridge has no exit method", () => {
    expect(detectExitBridge({ Android: { cachedStatus: () => {} } }).canExit).toBe(false);
    expect(detectExitBridge({ Android: { closeApp: "not a function" } }).canExit).toBe(false);
  });

  it.each(EXIT_METHOD_CANDIDATES)("exits through Android.%s, keeping the bridge as `this`", (name) => {
    const android: Record<string, unknown> = {};
    const method = vi.fn<() => void>(function (this: unknown) {
      expect(this).toBe(android);
    });
    android[name] = method;
    const bridge = detectExitBridge({ Android: android });
    expect(bridge.canExit).toBe(true);
    bridge.exit();
    expect(method).toHaveBeenCalledTimes(1);
  });

  it("describes the bridge and its methods without calling them", () => {
    const closeApp = vi.fn<() => void>();
    const report = describeContainer({ Android: { cachedStatus: () => {}, quit: () => {}, closeApp, version: "1" } });
    expect(report.bridges).toEqual([{ name: "Android", methods: ["cachedStatus", "closeApp", "quit"] }]);
    expect(report.exitMethod).toBe("closeApp");
    expect(closeApp).not.toHaveBeenCalled();
  });

  it("finds a bridge under another name, and reports when there is no exit method", () => {
    const report = describeContainer({
      NativeApp: { shutDown: () => {} },
      Math,
      TURBOPACK: { push: () => {} },
      webpackChunk: [1, 2],
    } as never);
    expect(report.bridges).toEqual([{ name: "NativeApp", methods: ["shutDown"] }]);
    expect(report.exitMethod).toBeNull();
    expect(describeContainer({}).bridges).toEqual([]);
  });

  it("stays in the game if the container throws", () => {
    const bridge = detectExitBridge({
      Android: {
        closeApp: () => {
          throw new Error("refused");
        },
      },
    });
    expect(() => bridge.exit()).not.toThrow();
  });
});

describe("notifyContainerCached", () => {
  it("tells the container the game is cached, keeping the bridge as `this`", () => {
    const android: Record<string, unknown> = {};
    const cachedStatus = vi.fn<(cached: boolean) => void>(function (this: unknown) {
      expect(this).toBe(android);
    });
    android["cachedStatus"] = cachedStatus;
    notifyContainerCached({ Android: android });
    expect(cachedStatus).toHaveBeenCalledWith(true);
  });

  it("does nothing in a normal browser and never throws", () => {
    expect(() => notifyContainerCached({})).not.toThrow();
    expect(() =>
      notifyContainerCached({
        Android: {
          cachedStatus: () => {
            throw new Error("nope");
          },
        },
      }),
    ).not.toThrow();
  });
});

describe("precache list includes word recordings", () => {
  it("adds extra urls once", () => {
    const urls = selectPrecacheUrls([], "https://app.test", ["/audio/words/sat.mp3", "/audio/words/sat.mp3"]);
    expect(urls).toEqual(["/", "/manifest.webmanifest", "/audio/words/sat.mp3"]);
  });
});

type Listener = () => void;
function fakeInstalling(state = "installing") {
  const listeners: Listener[] = [];
  const worker = {
    state,
    addEventListener: (_: "statechange", fn: Listener) => listeners.push(fn),
    finish(next: string) {
      worker.state = next;
      for (const l of listeners) l();
    },
  };
  return worker;
}

describe("checkRegistration", () => {
  it("reports offline without asking the server", async () => {
    const update = vi.fn<() => Promise<unknown>>();
    expect(await checkRegistration({ update, installing: null, waiting: null }, () => false)).toBe("offline");
    expect(update).not.toHaveBeenCalled();
  });

  it("reports up to date when no new worker appears", async () => {
    expect(await checkRegistration({ update: async () => {}, installing: null, waiting: null }, () => true)).toBe("up-to-date");
  });

  it("waits for a new version to finish downloading, then reports it ready", async () => {
    const installing = fakeInstalling();
    const reg: { -readonly [K in keyof RegistrationLike]: RegistrationLike[K] } = { update: async () => {}, installing, waiting: null };
    const result = checkRegistration(reg, () => true);
    await Promise.resolve();
    installing.finish("activated"); // our worker skips waiting
    expect(await result).toBe("update-ready");
  });

  it("treats a redundant new worker as no update", async () => {
    const installing = fakeInstalling();
    const result = checkRegistration({ update: async () => {}, installing, waiting: null }, () => true);
    await Promise.resolve();
    installing.finish("redundant");
    expect(await result).toBe("up-to-date");
  });

  it("reports an error (or offline) when the check itself fails", async () => {
    const failing = { update: () => Promise.reject(new Error("network")), installing: null, waiting: null };
    expect(await checkRegistration(failing, () => true)).toBe("error");
    let online = true;
    const dropping = { update: () => ((online = false), Promise.reject(new Error("network"))), installing: null, waiting: null };
    expect(await checkRegistration(dropping, () => online)).toBe("offline");
  });
});

describe("scheduleUpdateChecks", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (visibility: DocumentVisibilityState = "visible") => {
    const check = vi.fn<() => Promise<unknown>>(async () => "up-to-date");
    const doc = Object.assign(new EventTarget(), { visibilityState: visibility }) as unknown as Document;
    const win = Object.assign(new EventTarget(), {
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (id: number) => clearInterval(id),
    }) as unknown as Window;
    let clock = 0;
    const stop = scheduleUpdateChecks({ check, now: () => clock, intervalMs: 1000, minGapMs: 100, doc, win });
    return { check, doc, win, stop, advance: (ms: number) => ((clock += ms), vi.advanceTimersByTime(ms)) };
  };

  it("checks on a timer", () => {
    const { check, advance } = setup();
    advance(1000);
    advance(1000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("checks when the app comes back to the foreground or online, but not too often", () => {
    const { check, doc, win, advance } = setup();
    advance(200);
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("online")); // too soon after the last check
    expect(check).toHaveBeenCalledTimes(1);
    advance(200);
    win.dispatchEvent(new Event("online"));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("stops cleanly", () => {
    const { check, doc, stop, advance } = setup();
    stop();
    advance(5000);
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(check).not.toHaveBeenCalled();
  });
});
