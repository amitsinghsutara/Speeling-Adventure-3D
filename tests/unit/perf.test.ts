import { describe, expect, it } from "vitest";
import { createPerfMonitor, lowerQuality } from "@/game/graphics/perfMonitor";
import {
  AUTO_FLOOR_KEY,
  PREFERENCE_KEY,
  effectiveQuality,
  parsePreference,
  readAutoFloor,
  readQualityPreference,
  writeAutoFloor,
  writeQualityPreference,
  type StorageLike,
} from "@/game/graphics/qualityPreference";

function run(monitor: ReturnType<typeof createPerfMonitor>, fps: number, seconds: number) {
  const dt = 1 / fps;
  let suggestions = 0;
  for (let t = 0; t < seconds; t += dt) {
    if (monitor.sample(dt).suggestDowngrade) suggestions += 1;
  }
  return suggestions;
}

describe("createPerfMonitor", () => {
  it("averages the rolling window", () => {
    const monitor = createPerfMonitor({ windowSeconds: 1 });
    run(monitor, 60, 2);
    expect(monitor.averageFps).toBeCloseTo(60, 0);
    run(monitor, 20, 2);
    expect(monitor.averageFps).toBeCloseTo(20, 0);
  });

  it("ignores warm-up and short stutters, suggests after sustained slowness, then cools down", () => {
    const monitor = createPerfMonitor({ warmupSeconds: 4, sustainSeconds: 6, cooldownSeconds: 20, lowFpsThreshold: 24 });
    expect(run(monitor, 10, 3)).toBe(0); // warm-up
    expect(run(monitor, 60, 5)).toBe(0); // fine
    expect(run(monitor, 10, 2)).toBe(0); // a short stutter
    expect(run(monitor, 60, 2)).toBe(0);
    expect(run(monitor, 10, 9)).toBe(1); // sustained slow (window lag + 6 s) → one suggestion
    expect(run(monitor, 10, 10)).toBe(0); // cooling down
    expect(run(monitor, 10, 15)).toBe(1); // after cooldown, again
  });

  it("resets history", () => {
    const monitor = createPerfMonitor({ warmupSeconds: 0, sustainSeconds: 1 });
    run(monitor, 10, 2);
    monitor.reset();
    expect(monitor.averageFps).toBe(0);
    expect(run(monitor, 10, 0.5)).toBe(0);
  });

  it("steps presets down to a floor", () => {
    expect(lowerQuality("high")).toBe("medium");
    expect(lowerQuality("medium")).toBe("low");
    expect(lowerQuality("low")).toBeNull();
  });
});

describe("quality preference", () => {
  const memory = (): StorageLike & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  };

  it("parses and round-trips the preference and auto floor", () => {
    expect(parsePreference("high")).toBe("high");
    expect(parsePreference("ultra")).toBe("auto");
    const storage = memory();
    expect(readQualityPreference(storage)).toBe("auto");
    writeQualityPreference(storage, "low");
    expect(storage.data.get(PREFERENCE_KEY)).toBe("low");
    expect(readQualityPreference(storage)).toBe("low");
    writeQualityPreference(storage, "auto");
    expect(storage.data.has(PREFERENCE_KEY)).toBe(false);
    writeAutoFloor(storage, "medium");
    expect(storage.data.get(AUTO_FLOOR_KEY)).toBe("medium");
    expect(readAutoFloor(storage)).toBe("medium");
    writeAutoFloor(storage, null);
    expect(readAutoFloor(storage)).toBeNull();
  });

  it("tolerates missing or throwing storage", () => {
    expect(readQualityPreference(null)).toBe("auto");
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readQualityPreference(broken)).toBe("auto");
    expect(() => writeQualityPreference(broken, "high")).not.toThrow();
  });

  it("resolves the effective preset in priority order", () => {
    const base = { urlOverride: null, preference: "auto" as const, heuristic: "high" as const, autoFloor: null };
    expect(effectiveQuality(base)).toBe("high");
    expect(effectiveQuality({ ...base, autoFloor: "medium" })).toBe("medium");
    expect(effectiveQuality({ ...base, autoFloor: "high", heuristic: "low" })).toBe("low");
    expect(effectiveQuality({ ...base, preference: "low", autoFloor: "medium" })).toBe("low");
    expect(effectiveQuality({ ...base, urlOverride: "high", preference: "low" })).toBe("high");
    expect(effectiveQuality({ ...base, urlOverride: "nonsense", preference: "low" })).toBe("low");
  });
});
