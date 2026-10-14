/**
 * A learning event is one attempt at one question: immutable, local and
 * minimal. The schema is the source project's `src/learner/events.ts`
 * (PROVENANCE.md) so its learner model can be ported without migrating data.
 * No names, free text or device ids are stored.
 */
export const LEARNING_EVENT_SCHEMA_VERSION = 1 as const;
export const LOCAL_LEARNER_ID = "local-learner";

export interface LearningEvent {
  readonly schemaVersion: typeof LEARNING_EVENT_SCHEMA_VERSION;
  readonly id: string;
  /** Pseudonymous, device-local learner. One learner per device for now. */
  readonly learnerId: string;
  readonly sessionId: string;
  /** Groups the attempts made on one shown question. */
  readonly questionId: string;
  /** Epoch milliseconds. */
  readonly at: number;
  readonly contentVersion: string;
  readonly itemId: string;
  readonly skillId: string;
  readonly level: number;
  readonly puzzleId: string;
  /** Foil codes on screen for this question (scaffolding may show fewer than three). */
  readonly presentedFoilCodes: readonly string[];
  readonly chosenWord: string;
  readonly correct: boolean;
  /** Codebook code of the chosen foil; null when the target was chosen. */
  readonly chosenFoilCode: string | null;
  /** 1 for the first try at this question. */
  readonly attemptNumber: number;
  /** Milliseconds from the question appearing to this choice. */
  readonly elapsedMs: number;
  /** The adaptive decision that produced this question; null until the policy is ported. */
  readonly decisionId: string | null;
}

/** Random id; falls back for older WebViews without crypto.randomUUID. */
export function newId(): string {
  const c = typeof globalThis.crypto === "undefined" ? undefined : globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface AttemptFacts {
  readonly sessionId: string;
  readonly questionId: string;
  readonly at: number;
  readonly contentVersion: string;
  readonly itemId: string;
  readonly skillId: string;
  readonly level: number;
  readonly puzzleId: string;
  readonly presentedFoilCodes: readonly string[];
  readonly chosenWord: string;
  readonly correct: boolean;
  readonly chosenFoilCode?: string | undefined;
  readonly attemptNumber: number;
  readonly elapsedMs: number;
  readonly decisionId?: string | null | undefined;
}

export function createLearningEvent(facts: AttemptFacts, id: string = newId()): LearningEvent {
  const event: LearningEvent = {
    schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
    id,
    learnerId: LOCAL_LEARNER_ID,
    sessionId: facts.sessionId,
    questionId: facts.questionId,
    at: Math.round(facts.at),
    contentVersion: facts.contentVersion,
    itemId: facts.itemId,
    skillId: facts.skillId,
    level: facts.level,
    puzzleId: facts.puzzleId,
    presentedFoilCodes: [...facts.presentedFoilCodes],
    chosenWord: facts.chosenWord,
    correct: facts.correct,
    chosenFoilCode: facts.correct ? null : (facts.chosenFoilCode ?? null),
    attemptNumber: facts.attemptNumber,
    elapsedMs: Math.round(facts.elapsedMs),
    decisionId: facts.decisionId ?? null,
  };
  const parsed = parseLearningEvent(event);
  if (!parsed) throw new Error("createLearningEvent produced an invalid event");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const nonNegInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const posInt = (v: unknown): v is number => nonNegInt(v) && v > 0;

/** Validates a stored row; returns null for anything that is not a known event. */
export function parseLearningEvent(raw: unknown): LearningEvent | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== LEARNING_EVENT_SCHEMA_VERSION) return null;
  if (
    !nonEmpty(raw.id) ||
    !nonEmpty(raw.learnerId) ||
    !nonEmpty(raw.sessionId) ||
    !nonEmpty(raw.questionId) ||
    !nonNegInt(raw.at) ||
    !nonEmpty(raw.contentVersion) ||
    !nonEmpty(raw.itemId) ||
    !nonEmpty(raw.skillId) ||
    !posInt(raw.level) ||
    !nonEmpty(raw.puzzleId) ||
    !Array.isArray(raw.presentedFoilCodes) ||
    !raw.presentedFoilCodes.every(nonEmpty) ||
    !nonEmpty(raw.chosenWord) ||
    typeof raw.correct !== "boolean" ||
    !(raw.chosenFoilCode === null || nonEmpty(raw.chosenFoilCode)) ||
    !posInt(raw.attemptNumber) ||
    !nonNegInt(raw.elapsedMs) ||
    !(raw.decisionId === null || nonEmpty(raw.decisionId))
  ) {
    return null;
  }
  return {
    schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
    id: raw.id,
    learnerId: raw.learnerId,
    sessionId: raw.sessionId,
    questionId: raw.questionId,
    at: raw.at,
    contentVersion: raw.contentVersion,
    itemId: raw.itemId,
    skillId: raw.skillId,
    level: raw.level,
    puzzleId: raw.puzzleId,
    presentedFoilCodes: [...raw.presentedFoilCodes],
    chosenWord: raw.chosenWord,
    correct: raw.correct,
    chosenFoilCode: raw.chosenFoilCode,
    attemptNumber: raw.attemptNumber,
    elapsedMs: raw.elapsedMs,
    decisionId: raw.decisionId,
  };
}
