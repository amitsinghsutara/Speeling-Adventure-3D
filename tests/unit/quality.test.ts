import { describe, expect, it } from "vitest";
import {
  QUALITY_PRESETS,
  detectDefaultQuality,
  readDeviceHints,
} from "@/game/graphics/quality";

describe("detectDefaultQuality", () => {
  it("defaults touch devices to medium", () => {
    expect(
      detectDefaultQuality({
        coarsePointer: true,
        reducedMotion: false,
        logicalCores: 8,
        deviceMemoryGb: 6,
      }),
    ).toBe("medium");
  });

  it("drops entry-level phones to low", () => {
    expect(
      detectDefaultQuality({
        coarsePointer: true,
        reducedMotion: false,
        logicalCores: 4,
        deviceMemoryGb: 2,
      }),
    ).toBe("low");
    expect(
      detectDefaultQuality({
        coarsePointer: true,
        reducedMotion: false,
        logicalCores: 8,
        deviceMemoryGb: 3,
      }),
    ).toBe("low");
  });

  it("defaults desktops to high unless clearly weak", () => {
    expect(
      detectDefaultQuality({ coarsePointer: false, reducedMotion: false }),
    ).toBe("high");
    expect(
      detectDefaultQuality({
        coarsePointer: false,
        reducedMotion: false,
        logicalCores: 2,
      }),
    ).toBe("medium");
  });
});

describe("QUALITY_PRESETS", () => {
  it("scales cost monotonically from low to high", () => {
    const { low, medium, high } = QUALITY_PRESETS;
    expect(low.maxPixelRatio).toBeLessThanOrEqual(medium.maxPixelRatio);
    expect(medium.maxPixelRatio).toBeLessThanOrEqual(high.maxPixelRatio);
    expect(low.treeCount).toBeLessThan(medium.treeCount);
    expect(medium.treeCount).toBeLessThan(high.treeCount);
    expect(low.shadows).toBe(false);
  });
});

describe("readDeviceHints", () => {
  it("reads navigator and media queries defensively", () => {
    const hints = readDeviceHints({
      navigator: { hardwareConcurrency: 6, deviceMemory: 4 },
      matchMedia: (query) => ({ matches: query.includes("coarse") }),
    });
    expect(hints).toEqual({
      logicalCores: 6,
      deviceMemoryGb: 4,
      coarsePointer: true,
      reducedMotion: false,
    });
  });

  it("tolerates a window without matchMedia", () => {
    const hints = readDeviceHints({ navigator: {} });
    expect(hints.coarsePointer).toBe(false);
    expect(hints.reducedMotion).toBe(false);
    expect(hints.logicalCores).toBeUndefined();
  });
});
