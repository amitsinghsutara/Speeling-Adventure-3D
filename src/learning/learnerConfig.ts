/**
 * Learner-model settings, versioned so every derived result can say which
 * settings produced it. Ported from the source project (PROVENANCE.md).
 *
 * PROVISIONAL: these numbers are engineering placeholders, not confirmed by
 * the curriculum owner. They are kept in one place, flagged, and validated so
 * they can be replaced without code changes.
 */
export interface LearnerModelConfig {
  readonly version: string;
  /** True until a curriculum owner confirms every value below. */
  readonly provisional: boolean;
  readonly errorPattern: {
    /** Look only at the most recent N questions in which the foil type was on screen. */
    readonly windowQuestions: number;
    /** Minimum times the child picked that foil type in the window. */
    readonly minErrors: number;
    /** The errors must come from at least this many different words. */
    readonly minDistinctItems: number;
    /** Errors as a share of the questions in the window that showed that foil type. */
    readonly minErrorRate: number;
  };
  /**
   * Count only the first choice in each question. Later choices come after
   * a wrong tile is disabled, so they say less about what the child knows.
   */
  readonly firstChoiceOnly: boolean;
  /** Fewer questions than this in a skill means "not enough evidence yet". */
  readonly minQuestionsForEvidence: number;
}

const isPosInt = (v: number) => Number.isInteger(v) && v > 0;

/** Returns the problems with a config; an empty list means it is usable. */
export function validateLearnerModelConfig(c: LearnerModelConfig): string[] {
  const errors: string[] = [];
  if (!c.version) errors.push("version must be a non-empty string");
  const p = c.errorPattern;
  if (!isPosInt(p.windowQuestions)) errors.push("errorPattern.windowQuestions must be a positive integer");
  if (!Number.isInteger(p.minErrors)) errors.push("errorPattern.minErrors must be an integer");
  if (!Number.isInteger(p.minDistinctItems)) errors.push("errorPattern.minDistinctItems must be an integer");
  if (!(p.minErrorRate >= 0 && p.minErrorRate <= 1)) errors.push("errorPattern.minErrorRate must be between 0 and 1");
  if (!isPosInt(c.minQuestionsForEvidence)) errors.push("minQuestionsForEvidence must be a positive integer");
  // Constitution: an error pattern must never come from a single mistake.
  if (p.minErrors < 2) errors.push("errorPattern.minErrors must be at least 2 (a single mistake is never a pattern)");
  if (p.minDistinctItems < 2) errors.push("errorPattern.minDistinctItems must be at least 2 (one tricky word is not a pattern)");
  if (p.minErrors > p.windowQuestions) errors.push("errorPattern.minErrors cannot exceed windowQuestions");
  return errors;
}

export function parseLearnerModelConfig(c: LearnerModelConfig): LearnerModelConfig {
  const errors = validateLearnerModelConfig(c);
  if (errors.length > 0) throw new Error(`Invalid learner model config: ${errors.join("; ")}`);
  return c;
}

export const DEFAULT_LEARNER_MODEL_CONFIG: LearnerModelConfig = parseLearnerModelConfig({
  version: "learner-model/1-provisional",
  provisional: true,
  errorPattern: {
    windowQuestions: 10,
    minErrors: 3,
    minDistinctItems: 2,
    minErrorRate: 0.3,
  },
  firstChoiceOnly: true,
  minQuestionsForEvidence: 8,
});
