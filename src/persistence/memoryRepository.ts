import { parseAdaptiveDecision, type AdaptiveDecision } from "@/learning/decision";
import { parseLearningEvent, type LearningEvent } from "@/learning/events";
import {
  PROGRESS_KEY,
  backupKey,
  type LoadEventsResult,
  type LoadProgressResult,
  type LoadRowsResult,
  type ProgressRepository,
  type WriteResult,
} from "./repository";
import { migrateGameProgress, type GameProgress } from "./schemas";

export interface MemoryRepositoryOptions {
  readonly now?: () => number;
  /** Pre-seeded raw progress rows, including deliberately corrupt ones for tests. */
  readonly seedProgress?: Readonly<Record<string, unknown>>;
  readonly seedEvents?: readonly unknown[];
  readonly seedDecisions?: readonly unknown[];
}

/**
 * In-memory implementation used as the fallback when IndexedDB is missing
 * and as a fast, deterministic double in tests. Values are cloned on the way
 * in and out so callers cannot alias stored state.
 */
export function createMemoryRepository(
  options: MemoryRepositoryOptions = {},
): ProgressRepository & {
  readonly dump: () => { progress: Record<string, unknown>; events: unknown[]; decisions: unknown[] };
} {
  const now = options.now ?? Date.now;
  const progress = new Map<string, unknown>(Object.entries(options.seedProgress ?? {}));
  const events: unknown[] = [...(options.seedEvents ?? [])];
  const decisions: unknown[] = [...(options.seedDecisions ?? [])];
  const clone = <T>(value: T): T => structuredClone(value);

  return {
    persistent: false,
    async loadProgress(): Promise<LoadProgressResult> {
      if (!progress.has(PROGRESS_KEY)) return { status: "empty" };
      const raw = progress.get(PROGRESS_KEY);
      const parsed = migrateGameProgress(raw);
      if (parsed.ok) return { status: "ok", progress: parsed.value };
      const key = backupKey(now);
      progress.set(key, raw);
      progress.delete(PROGRESS_KEY);
      return { status: "recovered", reason: parsed.reason, backupKey: key };
    },
    async saveProgress(value: GameProgress): Promise<WriteResult> {
      progress.set(PROGRESS_KEY, clone(value));
      return { ok: true };
    },
    async appendLearningEvents(batch: readonly LearningEvent[]): Promise<WriteResult> {
      for (const event of batch) events.push(clone(event));
      return { ok: true };
    },
    async loadLearningEvents(): Promise<LoadEventsResult> {
      const valid: LearningEvent[] = [];
      let invalidCount = 0;
      for (const raw of events) {
        const parsed = parseLearningEvent(raw);
        if (parsed) valid.push(parsed);
        else invalidCount += 1;
      }
      return { events: valid, invalidCount };
    },
    async appendDecisions(batch: readonly AdaptiveDecision[]): Promise<WriteResult> {
      for (const decision of batch) decisions.push(clone(decision));
      return { ok: true };
    },
    async loadDecisions(): Promise<LoadRowsResult<AdaptiveDecision>> {
      const rows: AdaptiveDecision[] = [];
      let invalidCount = 0;
      for (const raw of decisions) {
        const parsed = parseAdaptiveDecision(raw);
        if (parsed) rows.push(parsed);
        else invalidCount += 1;
      }
      return { rows, invalidCount };
    },
    async clearAll(): Promise<WriteResult> {
      progress.clear();
      events.length = 0;
      decisions.length = 0;
      return { ok: true };
    },
    dump: () => ({ progress: Object.fromEntries(progress), events: [...events], decisions: [...decisions] }),
  };
}
