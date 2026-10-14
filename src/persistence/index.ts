import { createIndexedDbRepository } from "./indexedDbRepository";
import { createMemoryRepository } from "./memoryRepository";
import type { ProgressRepository } from "./repository";

/**
 * Chooses IndexedDB when the browser offers it, otherwise an in-memory
 * repository so the game still runs (progress then lasts for the session only
 * and the status reports `persistent: false`).
 */
export function createDefaultRepository(
  win: { indexedDB?: IDBFactory } | undefined = typeof window === "undefined"
    ? undefined
    : window,
): ProgressRepository {
  const factory = win?.indexedDB;
  if (!factory) return createMemoryRepository();
  return createIndexedDbRepository({ factory });
}

export type { ProgressRepository } from "./repository";
export { createMemoryRepository } from "./memoryRepository";
export { createIndexedDbRepository } from "./indexedDbRepository";
export { createProgressPersistence } from "./progressPersistence";
export type { PersistenceStatus, ProgressPersistence } from "./progressPersistence";
