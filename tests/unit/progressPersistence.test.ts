import { describe, expect, it } from "vitest";
import { INITIAL_QUEST_STATE } from "@/game/quest/questController";
import type { LearningEvent } from "@/learning/events";
import { createMemoryRepository } from "@/persistence/memoryRepository";
import {
  progressChanged,
  progressFromQuestState,
  questStateFromProgress,
} from "@/persistence/progressMapping";
import { createProgressPersistence } from "@/persistence/progressPersistence";
import type { ProgressRepository, WriteResult } from "@/persistence/repository";
import { createEmptyProgress, type GameProgress } from "@/persistence/schemas";

const EVENT: LearningEvent = {
  schemaVersion: 1,
  id: "evt-1",
  learnerId: "local-learner",
  sessionId: "s",
  questionId: "q",
  at: 1,
  contentVersion: "c",
  itemId: "item-001",
  skillId: "level-1",
  level: 1,
  puzzleId: "level-1/puzzle-1",
  presentedFoilCodes: ["V"],
  chosenWord: "sat",
  correct: true,
  chosenFoilCode: null,
  attemptNumber: 1,
  elapsedMs: 10,
  decisionId: null,
};

/** Wraps a repository so writes fail while `failing` is true. */
function flaky(inner: ProgressRepository) {
  const state = { failing: false, attempts: 0 };
  const fail = async (): Promise<WriteResult> => ({ ok: false, error: "disk full" });
  const repo: ProgressRepository = {
    ...inner,
    saveProgress: (p) => {
      state.attempts += 1;
      return state.failing ? fail() : inner.saveProgress(p);
    },
    appendLearningEvents: (e) => {
      state.attempts += 1;
      return state.failing ? fail() : inner.appendLearningEvents(e);
    },
  };
  return { repo, state };
}

describe("progress mapping", () => {
  it("builds quest state from progress and back", () => {
    const progress: GameProgress = {
      schemaVersion: 1,
      completedQuestIds: ["quest-1"],
      collectedRewardIds: ["star:quest-1"],
      updatedAt: "2026-10-14T00:00:00.000Z",
    };
    const state = questStateFromProgress(progress);
    expect(state.rewards).toEqual({ stars: 1, collectedRewardIds: ["star:quest-1"] });
    expect(state.completedQuestIds).toEqual(["quest-1"]);
    expect(state.phase).toBe("idle");
    const back = progressFromQuestState(state, () => new Date("2026-10-14T05:00:00Z"));
    expect(back).toEqual({ ...progress, updatedAt: "2026-10-14T05:00:00.000Z" });
    expect(questStateFromProgress(null)).toBe(INITIAL_QUEST_STATE);
  });

  it("detects changes by content, not identity", () => {
    const a = questStateFromProgress({
      ...createEmptyProgress(),
      completedQuestIds: ["q"],
      collectedRewardIds: ["s"],
    });
    const b = questStateFromProgress({
      ...createEmptyProgress(),
      completedQuestIds: ["q"],
      collectedRewardIds: ["s"],
    });
    expect(progressChanged(a, b)).toBe(false);
    expect(progressChanged(a, INITIAL_QUEST_STATE)).toBe(true);
  });
});

describe("createProgressPersistence", () => {
  it("restores stored progress and event count", async () => {
    const repo = createMemoryRepository();
    await repo.saveProgress({ ...createEmptyProgress(), completedQuestIds: ["q"] });
    await repo.appendLearningEvents([EVENT, EVENT]);
    const persistence = createProgressPersistence(repo);
    expect(persistence.getStatus().phase).toBe("restoring");
    const restored = await persistence.restore();
    expect(restored.progress?.completedQuestIds).toEqual(["q"]);
    expect(restored.storedEventCount).toBe(2);
    expect(restored.recovered).toBe(false);
    expect(persistence.getStatus()).toMatchObject({ phase: "ready", persistent: false });
  });

  it("reports recovery from corrupted storage", async () => {
    const repo = createMemoryRepository({ seedProgress: { current: { nope: 1 } } });
    const persistence = createProgressPersistence(repo);
    const restored = await persistence.restore();
    expect(restored.progress).toBeNull();
    expect(restored.recovered).toBe(true);
    expect(persistence.getStatus().recoveredFromCorruption).toBe(true);
    expect(persistence.getStatus().lastError).toMatch(/schemaVersion/);
  });

  it("saves progress and reports the save state", async () => {
    const repo = createMemoryRepository();
    const persistence = createProgressPersistence(repo);
    const states: string[] = [];
    persistence.subscribe(() => states.push(persistence.getStatus().lastSave));
    expect(await persistence.saveProgress({ ...createEmptyProgress(), completedQuestIds: ["q"] })).toBe(true);
    expect(states).toEqual(["saving", "saved"]);
    expect((await repo.loadProgress()).status).toBe("ok");
  });

  it("keeps a failed progress write and retries it later", async () => {
    const { repo, state } = flaky(createMemoryRepository());
    const scheduled: (() => void)[] = [];
    const persistence = createProgressPersistence(repo, {
      schedule: (fn) => scheduled.push(fn),
    });
    state.failing = true;
    const progress = { ...createEmptyProgress(), completedQuestIds: ["q"] };
    expect(await persistence.saveProgress(progress)).toBe(false);
    expect(persistence.getStatus()).toMatchObject({ lastSave: "failed", lastError: "disk full" });
    expect(scheduled).toHaveLength(1);

    state.failing = false;
    scheduled[0]!();
    await persistence.flush();
    expect(persistence.getStatus().lastSave).toBe("saved");
    expect(await repo.loadProgress()).toMatchObject({ status: "ok", progress });
  });

  it("never drops learning events while writes fail", async () => {
    const { repo, state } = flaky(createMemoryRepository());
    const scheduled: (() => void)[] = [];
    const persistence = createProgressPersistence(repo, { schedule: (fn) => scheduled.push(fn) });
    state.failing = true;
    persistence.recordLearningEvent(EVENT);
    persistence.recordLearningEvent({ ...EVENT, at: 2 });
    await persistence.flush();
    expect(persistence.getStatus().pendingEvents).toBe(2);
    expect((await repo.loadLearningEvents()).events).toEqual([]);

    state.failing = false;
    await persistence.flush();
    expect(persistence.getStatus().pendingEvents).toBe(0);
    expect((await repo.loadLearningEvents()).events).toEqual([EVENT, { ...EVENT, at: 2 }]);
    // Events written exactly once even after retries.
    expect((await repo.loadLearningEvents()).events).toHaveLength(2);
  });

  it("writes the latest progress when several saves overlap", async () => {
    const repo = createMemoryRepository();
    const persistence = createProgressPersistence(repo);
    const first = persistence.saveProgress({ ...createEmptyProgress(), completedQuestIds: ["a"] });
    const second = persistence.saveProgress({ ...createEmptyProgress(), completedQuestIds: ["a", "b"] });
    await Promise.all([first, second]);
    const loaded = await repo.loadProgress();
    expect(loaded.status === "ok" && loaded.progress.completedQuestIds).toEqual(["a", "b"]);
  });
});
