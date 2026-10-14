import type { AdaptiveDecision } from "@/learning/decision";
import type { LearningEvent } from "@/learning/events";
import type { ProgressRepository } from "./repository";
import type { GameProgress } from "./schemas";

export type SaveState = "none" | "saving" | "saved" | "failed";

export interface PersistenceStatus {
  readonly phase: "restoring" | "ready";
  readonly persistent: boolean;
  readonly lastSave: SaveState;
  /** Learning events and decisions not yet confirmed written; never dropped while the page lives. */
  readonly pendingEvents: number;
  readonly recoveredFromCorruption: boolean;
  readonly lastError: string | null;
}

export interface RestoredState {
  readonly progress: GameProgress | null;
  /** Valid stored learning events, oldest first (the learner model's history). */
  readonly events: readonly LearningEvent[];
  readonly storedEventCount: number;
  readonly recovered: boolean;
}

export interface ProgressPersistence {
  restore(): Promise<RestoredState>;
  /** Latest progress wins; a failed write is kept and retried by `flush`. */
  saveProgress(progress: GameProgress): Promise<boolean>;
  /** Queues an event for durable storage with automatic retry. */
  recordLearningEvent(event: LearningEvent): void;
  /** Queues an adaptive decision for durable storage with automatic retry. */
  recordDecision(decision: AdaptiveDecision): void;
  /** Retries anything pending (call on visibility change / pagehide). */
  flush(): Promise<void>;
  getStatus(): PersistenceStatus;
  subscribe(listener: () => void): () => void;
}

export interface ProgressPersistenceOptions {
  /** Delay before an automatic retry of failed writes. */
  readonly retryDelayMs?: number;
  readonly schedule?: (fn: () => void, delayMs: number) => void;
}

/**
 * Orchestrates writes over a repository: serialises them, retries failures
 * and exposes a small status object for the UI. It persists meaningful
 * changes only (quest completion, rewards, learning events), never frames.
 */
export function createProgressPersistence(
  repository: ProgressRepository,
  options: ProgressPersistenceOptions = {},
): ProgressPersistence {
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const schedule =
    options.schedule ?? ((fn: () => void, delay: number) => setTimeout(fn, delay));

  let status: PersistenceStatus = {
    phase: "restoring",
    persistent: repository.persistent,
    lastSave: "none",
    pendingEvents: 0,
    recoveredFromCorruption: false,
    lastError: null,
  };
  const listeners = new Set<() => void>();
  const setStatus = (patch: Partial<PersistenceStatus>) => {
    status = { ...status, ...patch };
    listeners.forEach((l) => l());
  };

  let pendingProgress: GameProgress | null = null;
  const pendingEvents: LearningEvent[] = [];
  const pendingDecisions: AdaptiveDecision[] = [];
  const pendingCount = () => pendingEvents.length + pendingDecisions.length;
  let chain: Promise<unknown> = Promise.resolve();
  let retryScheduled = false;
  let flushing = false;

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.catch(() => undefined);
    return next;
  };

  const scheduleRetry = () => {
    if (retryScheduled) return;
    retryScheduled = true;
    schedule(() => {
      retryScheduled = false;
      void flushInternal();
    }, retryDelayMs);
  };

  const writeProgress = async (): Promise<boolean> => {
    const progress = pendingProgress;
    if (!progress) return true;
    setStatus({ lastSave: "saving" });
    const result = await repository.saveProgress(progress);
    if (result.ok) {
      if (pendingProgress === progress) pendingProgress = null;
      setStatus({ lastSave: "saved", lastError: null });
      return true;
    }
    setStatus({ lastSave: "failed", lastError: result.error });
    scheduleRetry();
    return false;
  };

  const writeEvents = async (): Promise<boolean> => {
    let ok = true;
    if (pendingEvents.length > 0) {
      const batch = pendingEvents.slice();
      const result = await repository.appendLearningEvents(batch);
      if (result.ok) pendingEvents.splice(0, batch.length);
      else {
        ok = false;
        setStatus({ pendingEvents: pendingCount(), lastError: result.error });
      }
    }
    if (pendingDecisions.length > 0) {
      const batch = pendingDecisions.slice();
      const result = await repository.appendDecisions(batch);
      if (result.ok) pendingDecisions.splice(0, batch.length);
      else {
        ok = false;
        setStatus({ pendingEvents: pendingCount(), lastError: result.error });
      }
    }
    if (ok) setStatus({ pendingEvents: pendingCount(), lastError: null });
    else scheduleRetry();
    return ok;
  };

  const flushInternal = (): Promise<void> =>
    enqueue(async () => {
      if (flushing) return;
      flushing = true;
      try {
        await writeProgress();
        await writeEvents();
      } finally {
        flushing = false;
      }
    });

  return {
    async restore() {
      const [loaded, events] = await Promise.all([
        repository.loadProgress(),
        repository.loadLearningEvents(),
      ]);
      const recovered = loaded.status === "recovered";
      setStatus({
        phase: "ready",
        recoveredFromCorruption: recovered,
        lastError: recovered ? loaded.reason : (events.error ?? null),
      });
      return {
        progress: loaded.status === "ok" ? loaded.progress : null,
        events: [...events.events].sort((a, b) => a.at - b.at),
        storedEventCount: events.events.length,
        recovered,
      };
    },

    saveProgress(progress) {
      pendingProgress = progress;
      return enqueue(writeProgress);
    },

    recordLearningEvent(event) {
      pendingEvents.push(event);
      setStatus({ pendingEvents: pendingCount() });
      void enqueue(writeEvents);
    },

    recordDecision(decision) {
      pendingDecisions.push(decision);
      setStatus({ pendingEvents: pendingCount() });
      void enqueue(writeEvents);
    },

    flush: flushInternal,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
