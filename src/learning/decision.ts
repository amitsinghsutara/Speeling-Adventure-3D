/**
 * An adaptive decision: which word, which choices, and why. Stored locally,
 * referenced by the learning events it produces, and replayable from its
 * inputs. Shape ported from the source project (PROVENANCE.md); the optional
 * `adviser` block is not produced here because there is no AI adviser.
 */
import {
  isPresentationReason,
  isSkipReason,
  isStrategyReason,
  type PresentationReason,
  type SkipReason,
  type StrategyReason,
} from "./reasons";

export const DECISION_SCHEMA_VERSION = 1 as const;

export interface DecisionEvidence {
  readonly errorPattern?: {
    readonly foilCode: string;
    readonly errorRate: number;
    readonly evidenceEventIds: readonly string[];
  };
  readonly skillRecentAccuracy?: number | null;
  readonly skillQuestions?: number;
  readonly reviewSkillLastSeenAt?: number;
  readonly heldFoilCodes?: readonly string[];
}

export interface AdaptiveDecision {
  readonly schemaVersion: typeof DECISION_SCHEMA_VERSION;
  readonly id: string;
  readonly at: number;
  readonly policyVersion: string;
  readonly learnerModelVersion: string;
  readonly reasonCodesVersion: 1 | 2;
  /** True while any setting behind this decision is unconfirmed. */
  readonly provisional: boolean;
  readonly puzzleId: string;
  readonly itemId: string;
  readonly skillId: string;
  /** Foils presented, in the item's order (on-screen order is shuffled separately). */
  readonly foilWords: readonly string[];
  /** Their codes, same order. Words are needed too: 12 items have two foils with one code. */
  readonly foilCodes: readonly string[];
  readonly strategy: StrategyReason;
  readonly presentation: PresentationReason;
  /** Whether this question counts toward the puzzle's stars (only its own new words do). */
  readonly countsForStars: boolean;
  readonly evidence: DecisionEvidence;
  /** Strategies looked at before this one, and why each was not used. */
  readonly considered: readonly { readonly strategy: StrategyReason; readonly skipped: SkipReason }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(nonEmpty);

/** Validates a stored row; returns null for anything that is not a known decision. */
export function parseAdaptiveDecision(raw: unknown): AdaptiveDecision | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== DECISION_SCHEMA_VERSION) return null;
  if (
    !nonEmpty(raw.id) ||
    typeof raw.at !== "number" ||
    !nonEmpty(raw.policyVersion) ||
    !nonEmpty(raw.learnerModelVersion) ||
    !(raw.reasonCodesVersion === 1 || raw.reasonCodesVersion === 2) ||
    typeof raw.provisional !== "boolean" ||
    !nonEmpty(raw.puzzleId) ||
    !nonEmpty(raw.itemId) ||
    !nonEmpty(raw.skillId) ||
    !strings(raw.foilWords) ||
    raw.foilWords.length === 0 ||
    !strings(raw.foilCodes) ||
    raw.foilCodes.length !== raw.foilWords.length ||
    !isStrategyReason(raw.strategy) ||
    !isPresentationReason(raw.presentation) ||
    typeof raw.countsForStars !== "boolean" ||
    !isRecord(raw.evidence) ||
    !Array.isArray(raw.considered)
  ) {
    return null;
  }
  const considered: { strategy: StrategyReason; skipped: SkipReason }[] = [];
  for (const entry of raw.considered) {
    if (!isRecord(entry) || !isStrategyReason(entry.strategy) || !isSkipReason(entry.skipped)) return null;
    considered.push({ strategy: entry.strategy, skipped: entry.skipped });
  }
  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    id: raw.id,
    at: raw.at,
    policyVersion: raw.policyVersion,
    learnerModelVersion: raw.learnerModelVersion,
    reasonCodesVersion: raw.reasonCodesVersion,
    provisional: raw.provisional,
    puzzleId: raw.puzzleId,
    itemId: raw.itemId,
    skillId: raw.skillId,
    foilWords: [...raw.foilWords],
    foilCodes: [...raw.foilCodes],
    strategy: raw.strategy,
    presentation: raw.presentation,
    countsForStars: raw.countsForStars,
    evidence: raw.evidence as DecisionEvidence,
    considered,
  };
}
