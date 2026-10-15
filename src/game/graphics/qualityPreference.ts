import { isQualityLevel, type QualityLevel } from "./quality";

/**
 * Graphics preference: "auto" (device heuristic plus the automatic safety
 * net) or a fixed preset. Stored per browser as a convenience; it never
 * affects progress, so localStorage is the right place for it.
 */
export type QualityPreference = "auto" | QualityLevel;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PREFERENCE_KEY = "sa3d.quality.preference";
/** Lowest preset the safety net has settled on while in auto mode. */
export const AUTO_FLOOR_KEY = "sa3d.quality.autoFloor";

export function parsePreference(raw: unknown): QualityPreference {
  return raw === "auto" || isQualityLevel(raw) ? raw : "auto";
}

export function readQualityPreference(storage: StorageLike | null): QualityPreference {
  try {
    return parsePreference(storage?.getItem(PREFERENCE_KEY));
  } catch {
    return "auto";
  }
}

export function writeQualityPreference(storage: StorageLike | null, value: QualityPreference): void {
  try {
    if (value === "auto") storage?.removeItem(PREFERENCE_KEY);
    else storage?.setItem(PREFERENCE_KEY, value);
  } catch {
    // Storage may be blocked (private mode); the choice still applies this session.
  }
}

export function readAutoFloor(storage: StorageLike | null): QualityLevel | null {
  try {
    const raw = storage?.getItem(AUTO_FLOOR_KEY);
    return isQualityLevel(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeAutoFloor(storage: StorageLike | null, level: QualityLevel | null): void {
  try {
    if (level === null) storage?.removeItem(AUTO_FLOOR_KEY);
    else storage?.setItem(AUTO_FLOOR_KEY, level);
  } catch {
    // Ignore.
  }
}

const RANK: Record<QualityLevel, number> = { low: 0, medium: 1, high: 2 };

/**
 * Effective preset: a URL override wins (device testing), then a fixed
 * preference, then the heuristic capped by the auto floor.
 */
export function effectiveQuality(input: {
  readonly urlOverride: unknown;
  readonly preference: QualityPreference;
  readonly heuristic: QualityLevel;
  readonly autoFloor: QualityLevel | null;
}): QualityLevel {
  if (isQualityLevel(input.urlOverride)) return input.urlOverride;
  if (input.preference !== "auto") return input.preference;
  if (input.autoFloor && RANK[input.autoFloor] < RANK[input.heuristic]) return input.autoFloor;
  return input.heuristic;
}
