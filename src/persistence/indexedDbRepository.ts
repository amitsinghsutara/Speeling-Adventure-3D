import { parseLearningEvent, type LearningEvent } from "@/learning/events";
import {
  PROGRESS_KEY,
  backupKey,
  type LoadEventsResult,
  type LoadProgressResult,
  type ProgressRepository,
  type WriteResult,
} from "./repository";
import { migrateGameProgress, type GameProgress } from "./schemas";

export const DB_NAME = "spelling-adventure-3d";
export const DB_VERSION = 1;
export const STORE_PROGRESS = "progress";
export const STORE_EVENTS = "learningEvents";

export interface IndexedDbRepositoryOptions {
  readonly factory: IDBFactory;
  readonly now?: () => number;
  readonly dbName?: string;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "object" && error !== null && "name" in error) {
    return String((error as { name: unknown }).name);
  }
  return String(error);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS);
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        db.createObjectStore(STORE_EVENTS, { autoIncrement: true });
      }
    };
    request.onblocked = () => reject(new Error("IndexedDB open blocked by another tab"));
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => {
      const db = request.result;
      // Another tab is upgrading: close so it can proceed; we reopen lazily.
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

/**
 * IndexedDB-backed repository. Every public method resolves to a typed
 * result and never throws. The database is opened lazily and reopened after
 * a failure, so a transient error does not poison the session.
 */
export function createIndexedDbRepository(
  options: IndexedDbRepositoryOptions,
): ProgressRepository {
  const now = options.now ?? Date.now;
  const dbName = options.dbName ?? DB_NAME;
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = openDatabase(options.factory, dbName).catch((error: unknown) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  };

  const transaction = async <T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    work: (tx: IDBTransaction) => Promise<T>,
  ): Promise<T> => {
    const db = await getDb();
    const tx = db.transaction(storeNames, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });
    try {
      const result = await work(tx);
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        // Already finished.
      }
      if (
        error instanceof Error &&
        (error.name === "InvalidStateError" || error.message.includes("closing"))
      ) {
        dbPromise = null; // Connection was closed; reopen next time.
      }
      throw error;
    }
  };

  return {
    persistent: true,

    async loadProgress(): Promise<LoadProgressResult> {
      try {
        return await transaction(STORE_PROGRESS, "readwrite", async (tx) => {
          const store = tx.objectStore(STORE_PROGRESS);
          const raw = await requestToPromise(store.get(PROGRESS_KEY));
          if (raw === undefined) return { status: "empty" } as const;
          const parsed = migrateGameProgress(raw);
          if (parsed.ok) return { status: "ok", progress: parsed.value } as const;
          const key = backupKey(now);
          await requestToPromise(store.put(raw, key));
          await requestToPromise(store.delete(PROGRESS_KEY));
          return { status: "recovered", reason: parsed.reason, backupKey: key } as const;
        });
      } catch (error) {
        // Unreadable storage: start fresh for this session without deleting anything.
        return {
          status: "recovered",
          reason: `storage unavailable: ${describeError(error)}`,
          backupKey: "",
        };
      }
    },

    async saveProgress(progress: GameProgress): Promise<WriteResult> {
      try {
        await transaction(STORE_PROGRESS, "readwrite", async (tx) => {
          await requestToPromise(tx.objectStore(STORE_PROGRESS).put(progress, PROGRESS_KEY));
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeError(error) };
      }
    },

    async appendLearningEvents(events: readonly LearningEvent[]): Promise<WriteResult> {
      if (events.length === 0) return { ok: true };
      try {
        await transaction(STORE_EVENTS, "readwrite", async (tx) => {
          const store = tx.objectStore(STORE_EVENTS);
          for (const event of events) {
            await requestToPromise(store.add(event));
          }
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeError(error) };
      }
    },

    async loadLearningEvents(): Promise<LoadEventsResult> {
      try {
        const rows = await transaction(STORE_EVENTS, "readonly", async (tx) =>
          requestToPromise(tx.objectStore(STORE_EVENTS).getAll()),
        );
        const events: LearningEvent[] = [];
        let invalidCount = 0;
        for (const raw of rows as unknown[]) {
          const parsed = parseLearningEvent(raw);
          if (parsed) events.push(parsed);
          else invalidCount += 1;
        }
        return { events, invalidCount };
      } catch (error) {
        return { events: [], invalidCount: 0, error: describeError(error) };
      }
    },

    async clearAll(): Promise<WriteResult> {
      try {
        await transaction([STORE_PROGRESS, STORE_EVENTS], "readwrite", async (tx) => {
          await requestToPromise(tx.objectStore(STORE_PROGRESS).clear());
          await requestToPromise(tx.objectStore(STORE_EVENTS).clear());
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeError(error) };
      }
    },
  };
}
