import type { AdaptiveDecision } from "@/learning/decision";
import type { LearningEvent } from "@/learning/events";
import type { GameProgress } from "./schemas";

/**
 * Typed repository boundary for local persistence (FR-08). Implementations
 * never throw: every failure is a value the caller can act on, so a failed
 * write can be retried and corrupted data never crashes the game.
 */
export type LoadProgressResult =
  | { readonly status: "empty" }
  | { readonly status: "ok"; readonly progress: GameProgress }
  | {
      /** Stored data was unreadable; it was moved to a backup and the game starts fresh. */
      readonly status: "recovered";
      readonly reason: string;
      readonly backupKey: string;
    };

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export interface LoadRowsResult<T> {
  readonly rows: readonly T[];
  /** Rows that failed validation and were skipped (never deleted). */
  readonly invalidCount: number;
  readonly error?: string;
}

export interface LoadEventsResult {
  readonly events: readonly LearningEvent[];
  readonly invalidCount: number;
  readonly error?: string;
}

export interface ProgressRepository {
  /** False when running on an in-memory fallback (storage unavailable). */
  readonly persistent: boolean;
  loadProgress(): Promise<LoadProgressResult>;
  saveProgress(progress: GameProgress): Promise<WriteResult>;
  appendLearningEvents(events: readonly LearningEvent[]): Promise<WriteResult>;
  loadLearningEvents(): Promise<LoadEventsResult>;
  /** Adaptive decisions, so every question can be explained and replayed. */
  appendDecisions(decisions: readonly AdaptiveDecision[]): Promise<WriteResult>;
  loadDecisions(): Promise<LoadRowsResult<AdaptiveDecision>>;
  /** Removes progress, backups, events and decisions. Used by the development reset. */
  clearAll(): Promise<WriteResult>;
}

export const PROGRESS_KEY = "current";
export const BACKUP_KEY_PREFIX = "backup:";

export function backupKey(now: () => number = Date.now): string {
  return `${BACKUP_KEY_PREFIX}${now()}`;
}
