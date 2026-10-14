import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import type { LearningEvent } from "@/learning/events";
import { createIndexedDbRepository } from "@/persistence/indexedDbRepository";
import { createMemoryRepository } from "@/persistence/memoryRepository";
import { BACKUP_KEY_PREFIX, type ProgressRepository } from "@/persistence/repository";
import { createEmptyProgress, type GameProgress } from "@/persistence/schemas";

const PROGRESS: GameProgress = {
  schemaVersion: 1,
  completedQuestIds: ["quest-1"],
  collectedRewardIds: ["star:quest-1"],
  updatedAt: "2026-10-14T00:00:00.000Z",
};

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

interface Harness {
  name: string;
  /** Fresh repository; `seed` writes raw rows underneath the abstraction. */
  create(seed?: { progress?: unknown; events?: unknown[] }): Promise<ProgressRepository>;
  /** Raw progress keys present in storage (to check backups). */
  progressKeys(repo: ProgressRepository): Promise<string[]>;
}

const memoryHarness: Harness = {
  name: "memory",
  async create(seed) {
    return createMemoryRepository({
      now: () => 42,
      seedProgress: seed?.progress !== undefined ? { current: seed.progress } : {},
      seedEvents: seed?.events,
    });
  },
  async progressKeys(repo) {
    return Object.keys((repo as ReturnType<typeof createMemoryRepository>).dump().progress);
  },
};

function rawPut(factory: IDBFactory, store: string, value: unknown, key?: string) {
  return new Promise<void>((resolve, reject) => {
    const open = factory.open("test-db", 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("progress");
      open.result.createObjectStore("learningEvents", { autoIncrement: true });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(store, "readwrite");
      if (key === undefined) tx.objectStore(store).add(value);
      else tx.objectStore(store).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}

function rawKeys(factory: IDBFactory, store: string) {
  return new Promise<string[]>((resolve, reject) => {
    const open = factory.open("test-db", 1);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction(store, "readonly").objectStore(store).getAllKeys();
      req.onsuccess = () => {
        db.close();
        resolve(req.result.map(String));
      };
      req.onerror = () => reject(req.error);
    };
    open.onerror = () => reject(open.error);
  });
}

const factories = new WeakMap<ProgressRepository, IDBFactory>();
const indexedDbHarness: Harness = {
  name: "indexeddb",
  async create(seed) {
    const factory = new IDBFactory();
    if (seed?.progress !== undefined) await rawPut(factory, "progress", seed.progress, "current");
    for (const event of seed?.events ?? []) await rawPut(factory, "learningEvents", event);
    const repo = createIndexedDbRepository({ factory, now: () => 42, dbName: "test-db" });
    factories.set(repo, factory);
    return repo;
  },
  async progressKeys(repo) {
    return rawKeys(factories.get(repo)!, "progress");
  },
};

describe.each([memoryHarness, indexedDbHarness])("$name repository", (harness) => {
  it("reports empty before anything is saved", async () => {
    const repo = await harness.create();
    expect(await repo.loadProgress()).toEqual({ status: "empty" });
    expect(await repo.loadLearningEvents()).toEqual({ events: [], invalidCount: 0 });
  });

  it("round-trips progress", async () => {
    const repo = await harness.create();
    expect(await repo.saveProgress(PROGRESS)).toEqual({ ok: true });
    expect(await repo.loadProgress()).toEqual({ status: "ok", progress: PROGRESS });
    const newer = { ...PROGRESS, completedQuestIds: ["quest-1", "quest-2"] };
    await repo.saveProgress(newer);
    expect(await repo.loadProgress()).toEqual({ status: "ok", progress: newer });
  });

  it("moves corrupted progress to a backup and starts fresh", async () => {
    const repo = await harness.create({ progress: { schemaVersion: 1, completedQuestIds: "bad" } });
    const loaded = await repo.loadProgress();
    expect(loaded.status).toBe("recovered");
    if (loaded.status === "recovered") {
      expect(loaded.reason).toMatch(/completedQuestIds/);
      expect(loaded.backupKey).toBe(`${BACKUP_KEY_PREFIX}42`);
    }
    expect(await repo.loadProgress()).toEqual({ status: "empty" });
    const keys = await harness.progressKeys(repo);
    expect(keys).toContain(`${BACKUP_KEY_PREFIX}42`);
    expect(keys).not.toContain("current");
  });

  it("recovers from non-object garbage too", async () => {
    const repo = await harness.create({ progress: "garbage" });
    expect((await repo.loadProgress()).status).toBe("recovered");
  });

  it("appends and reloads learning events, skipping invalid rows without deleting them", async () => {
    const repo = await harness.create({ events: [{ junk: true }] });
    expect(await repo.appendLearningEvents([EVENT, { ...EVENT, at: 2 }])).toEqual({ ok: true });
    const loaded = await repo.loadLearningEvents();
    expect(loaded.events).toEqual([EVENT, { ...EVENT, at: 2 }]);
    expect(loaded.invalidCount).toBe(1);
    expect(await repo.appendLearningEvents([])).toEqual({ ok: true });
  });

  it("clears everything", async () => {
    const repo = await harness.create();
    await repo.saveProgress(createEmptyProgress());
    await repo.appendLearningEvents([EVENT]);
    expect(await repo.clearAll()).toEqual({ ok: true });
    expect(await repo.loadProgress()).toEqual({ status: "empty" });
    expect((await repo.loadLearningEvents()).events).toEqual([]);
  });
});

describe("indexeddb repository failure handling", () => {
  it("returns typed failures instead of throwing when the database cannot open", async () => {
    const broken = {
      open: () => {
        throw new Error("blocked by policy");
      },
    } as unknown as IDBFactory;
    const repo = createIndexedDbRepository({ factory: broken });
    const loaded = await repo.loadProgress();
    expect(loaded.status).toBe("recovered");
    if (loaded.status === "recovered") expect(loaded.reason).toMatch(/blocked by policy/);
    expect(await repo.saveProgress(PROGRESS)).toMatchObject({ ok: false });
    expect(await repo.appendLearningEvents([EVENT])).toMatchObject({ ok: false });
    expect((await repo.loadLearningEvents()).error).toMatch(/blocked by policy/);
    expect(await repo.clearAll()).toMatchObject({ ok: false });
  });

  it("does not expose stored objects by reference (memory)", async () => {
    const repo = createMemoryRepository();
    const progress = { ...PROGRESS, completedQuestIds: ["a"] };
    await repo.saveProgress(progress);
    (progress.completedQuestIds as string[]).push("mutated");
    const loaded = await repo.loadProgress();
    expect(loaded.status === "ok" && loaded.progress.completedQuestIds).toEqual(["a"]);
  });
});
