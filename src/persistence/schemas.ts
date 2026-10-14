/**
 * Versioned local progress schema (data-contracts.md "Game progress").
 * Learning events use their own schema in `src/learning/events.ts`; a star or
 * collectible never implies mastery.
 */
export const GAME_PROGRESS_SCHEMA_VERSION = 1 as const;

export interface GameProgress {
  readonly schemaVersion: typeof GAME_PROGRESS_SCHEMA_VERSION;
  readonly completedQuestIds: readonly string[];
  readonly collectedRewardIds: readonly string[];
  /** ISO-8601 timestamp of the last meaningful change. */
  readonly updatedAt: string;
}

export function createEmptyProgress(now: () => Date = () => new Date()): GameProgress {
  return {
    schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
    completedQuestIds: [],
    collectedRewardIds: [],
    updatedAt: now().toISOString(),
  };
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/** Strict parse of the *current* schema version. */
export function parseGameProgress(raw: unknown): ParseResult<GameProgress> {
  if (!isRecord(raw)) return { ok: false, reason: "progress is not an object" };
  if (raw.schemaVersion !== GAME_PROGRESS_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `unexpected schemaVersion ${String(raw.schemaVersion)}`,
    };
  }
  if (!isStringArray(raw.completedQuestIds)) {
    return { ok: false, reason: "completedQuestIds must be string[]" };
  }
  if (!isStringArray(raw.collectedRewardIds)) {
    return { ok: false, reason: "collectedRewardIds must be string[]" };
  }
  if (typeof raw.updatedAt !== "string" || Number.isNaN(Date.parse(raw.updatedAt))) {
    return { ok: false, reason: "updatedAt must be an ISO date string" };
  }
  return {
    ok: true,
    value: {
      schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
      completedQuestIds: uniqueStrings(raw.completedQuestIds),
      collectedRewardIds: uniqueStrings(raw.collectedRewardIds),
      updatedAt: raw.updatedAt,
    },
  };
}

/** Maps a stored schemaVersion to a function producing the next version. */
export type Migration = (previous: unknown) => unknown;
export type MigrationTable = Readonly<Record<number, Migration>>;

/** No historical versions exist yet; the table is empty by design. */
export const PROGRESS_MIGRATIONS: MigrationTable = {};

/**
 * Upgrades stored data step by step to the current version, then parses it.
 * Fails (rather than guessing) when a step is missing or the data is newer
 * than this build understands; the caller treats that as recoverable.
 */
export function migrateGameProgress(
  raw: unknown,
  migrations: MigrationTable = PROGRESS_MIGRATIONS,
  currentVersion: number = GAME_PROGRESS_SCHEMA_VERSION,
): ParseResult<GameProgress> {
  if (!isRecord(raw)) return { ok: false, reason: "progress is not an object" };
  const initialVersion = raw.schemaVersion;
  if (typeof initialVersion !== "number" || !Number.isInteger(initialVersion)) {
    return { ok: false, reason: "missing schemaVersion" };
  }
  let version: number = initialVersion;
  if (version > currentVersion) {
    return {
      ok: false,
      reason: `schemaVersion ${version} is newer than supported ${currentVersion}`,
    };
  }
  let data: unknown = raw;
  for (let guard = 0; version < currentVersion && guard < 100; guard += 1) {
    const step = migrations[version];
    if (!step) {
      return { ok: false, reason: `no migration from schemaVersion ${version}` };
    }
    try {
      data = step(data);
    } catch (error) {
      return {
        ok: false,
        reason: `migration from ${version} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
    if (!isRecord(data) || typeof data.schemaVersion !== "number") {
      return { ok: false, reason: `migration from ${version} produced invalid data` };
    }
    version = data.schemaVersion as number;
  }
  return parseGameProgress(data);
}
