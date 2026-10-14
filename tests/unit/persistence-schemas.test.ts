import { describe, expect, it } from "vitest";
import {
  GAME_PROGRESS_SCHEMA_VERSION,
  createEmptyProgress,
  migrateGameProgress,
  parseGameProgress,
} from "@/persistence/schemas";

const VALID = {
  schemaVersion: 1,
  completedQuestIds: ["quest-1"],
  collectedRewardIds: ["star:quest-1"],
  updatedAt: "2026-10-14T00:00:00.000Z",
};

describe("parseGameProgress", () => {
  it("accepts valid progress and de-duplicates ids", () => {
    const result = parseGameProgress({
      ...VALID,
      completedQuestIds: ["a", "a", "b"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.completedQuestIds).toEqual(["a", "b"]);
  });

  it("rejects malformed progress with a reason", () => {
    const cases: [unknown, RegExp][] = [
      [null, /not an object/],
      [{ ...VALID, schemaVersion: 2 }, /schemaVersion/],
      [{ ...VALID, completedQuestIds: "nope" }, /completedQuestIds/],
      [{ ...VALID, collectedRewardIds: [1] }, /collectedRewardIds/],
      [{ ...VALID, updatedAt: "yesterday" }, /updatedAt/],
    ];
    for (const [raw, pattern] of cases) {
      const result = parseGameProgress(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(pattern);
    }
  });

  it("creates empty progress at the current version", () => {
    const empty = createEmptyProgress(() => new Date("2026-10-14T01:02:03Z"));
    expect(empty).toEqual({
      schemaVersion: GAME_PROGRESS_SCHEMA_VERSION,
      completedQuestIds: [],
      collectedRewardIds: [],
      updatedAt: "2026-10-14T01:02:03.000Z",
    });
  });
});

describe("migrateGameProgress", () => {
  it("passes current data straight through", () => {
    expect(migrateGameProgress(VALID)).toEqual({ ok: true, value: VALID });
  });

  it("applies registered migrations step by step", () => {
    const legacy = { schemaVersion: 1, done: ["q"], stars: ["s"] };
    const result = migrateGameProgress(
      legacy,
      {
        1: (prev) => {
          const p = prev as { done: string[]; stars: string[] };
          return { schemaVersion: 2, completedQuestIds: p.done, rewards: p.stars };
        },
        2: (prev) => {
          const p = prev as { completedQuestIds: string[]; rewards: string[] };
          return {
            schemaVersion: 3,
            completedQuestIds: p.completedQuestIds,
            collectedRewardIds: p.rewards,
            updatedAt: "2026-01-01T00:00:00.000Z",
          };
        },
      },
      3,
    );
    // The final parse still enforces the *real* current version (1), so this
    // exercises the stepping logic and the strict parse together.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/schemaVersion 3/);
  });

  it("fails rather than guessing when a migration step is missing", () => {
    const result = migrateGameProgress({ schemaVersion: 0 }, {}, 1);
    expect(result).toEqual({ ok: false, reason: "no migration from schemaVersion 0" });
  });

  it("refuses data newer than this build understands", () => {
    const result = migrateGameProgress({ ...VALID, schemaVersion: 9 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/newer/);
  });

  it("reports a throwing migration", () => {
    const result = migrateGameProgress(
      { schemaVersion: 0 },
      {
        0: () => {
          throw new Error("boom");
        },
      },
      1,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/boom/);
  });
});
