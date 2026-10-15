export type QualityLevel = "low" | "medium" | "high";

export interface QualitySettings {
  readonly level: QualityLevel;
  /** Upper bound for the device pixel ratio the renderer is allowed to use. */
  readonly maxPixelRatio: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly antialias: boolean;
  readonly treeCount: number;
  readonly forestTreeCount: number;
  readonly bushCount: number;
  readonly grassCount: number;
  readonly flowerCount: number;
  readonly rockCount: number;
  readonly cloudCount: number;
}

/**
 * Scalable quality presets. Counts are deliberately small: the first
 * milestone is a compact meadow, not a forest, and entry-level Android phones
 * are the baseline.
 */
export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualitySettings>> = {
  low: {
    level: "low",
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 0,
    antialias: false,
    treeCount: 40,
    forestTreeCount: 140,
    bushCount: 32,
    grassCount: 7000,
    flowerCount: 300,
    rockCount: 12,
    cloudCount: 5,
  },
  medium: {
    level: "medium",
    maxPixelRatio: 1.5,
    shadows: false,
    shadowMapSize: 0,
    antialias: true,
    treeCount: 60,
    forestTreeCount: 240,
    bushCount: 56,
    grassCount: 16000,
    flowerCount: 600,
    rockCount: 18,
    cloudCount: 7,
  },
  high: {
    level: "high",
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    treeCount: 80,
    forestTreeCount: 340,
    bushCount: 90,
    grassCount: 30000,
    flowerCount: 1000,
    rockCount: 22,
    cloudCount: 9,
  },
};

export interface DeviceHints {
  /** `navigator.hardwareConcurrency`, when exposed. */
  readonly logicalCores?: number;
  /** `navigator.deviceMemory` in GiB (Chromium only, capped at 8). */
  readonly deviceMemoryGb?: number;
  /** True when the primary pointer is a finger (phones and tablets). */
  readonly coarsePointer: boolean;
  readonly reducedMotion: boolean;
}

/**
 * Conservative heuristic for the default quality level. It can be overridden
 * by an explicit user setting later; it is intentionally biased towards
 * "medium" on touch devices because real Android measurements are still
 * pending (see spec FR-10).
 */
export function detectDefaultQuality(hints: DeviceHints): QualityLevel {
  const cores = hints.logicalCores ?? 4;
  const memory = hints.deviceMemoryGb ?? 4;

  if (hints.coarsePointer) {
    if (memory <= 3 || cores <= 4) return "low";
    return "medium";
  }
  if (memory <= 2 || cores <= 2) return "medium";
  return "high";
}

export function isQualityLevel(value: unknown): value is QualityLevel {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * Final quality level: an explicit override (user setting or `?quality=`
 * query parameter for device testing) wins over the heuristic.
 */
export function resolveQualityLevel(
  hints: DeviceHints,
  override: unknown,
): QualityLevel {
  return isQualityLevel(override) ? override : detectDefaultQuality(hints);
}

interface NavigatorLike {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

interface WindowLike {
  navigator: NavigatorLike;
  matchMedia?: (query: string) => { matches: boolean };
}

export function readDeviceHints(win: WindowLike): DeviceHints {
  const matches = (query: string): boolean =>
    typeof win.matchMedia === "function" ? win.matchMedia(query).matches : false;
  return {
    logicalCores: win.navigator.hardwareConcurrency,
    deviceMemoryGb: win.navigator.deviceMemory,
    coarsePointer: matches("(pointer: coarse)"),
    reducedMotion: matches("(prefers-reduced-motion: reduce)"),
  };
}
