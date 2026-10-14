/**
 * Adaptive policy settings, versioned and stored with every decision. Ported
 * from the source project (PROVENANCE.md).
 *
 * PROVISIONAL: engineering placeholders, not confirmed by the curriculum owner.
 * The only source-backed rule is the shape of the tier gate: the spreadsheet's
 * ResearchBasis suggests Tier 1-2 foils while unsure and Tier 3-4 after
 * accuracy passes a threshold. The numbers are still ours.
 */
export interface PolicyConfig {
  readonly version: string;
  readonly provisional: boolean;
  /** Extra (non-curriculum-order) questions allowed per puzzle. */
  readonly maxExtraQuestionsPerPuzzle: number;
  /** Fewest foils ever shown: a question always has at least this many wrong choices. */
  readonly minFoils: number;
  readonly focus: { readonly maxPerPuzzle: number };
  readonly scaffold: {
    /** Look at this many most recent questions in the skill... */
    readonly recentQuestions: number;
    /** ...and scaffold if at most this many were right on the first try. */
    readonly maxFirstTryCorrect: number;
    /** How many foils a scaffolded question shows. */
    readonly foilCount: number;
  };
  readonly tierGate: {
    /** Foils at or above this codebook tier are "harder". */
    readonly hardTierFrom: number;
    /** Questions needed in the skill before harder tiers can be introduced. */
    readonly minQuestions: number;
    /** Recent first-try accuracy needed in the skill. */
    readonly minAccuracy: number;
  };
  readonly transfer: {
    readonly maxPerPuzzle: number;
    /** Recent first-try accuracy needed before testing transfer to an unseen word. */
    readonly minAccuracy: number;
  };
  readonly review: {
    readonly maxPerPuzzle: number;
    /** An earlier skill is due once it has not been practised for this long. */
    readonly dueAfterMs: number;
  };
  readonly mixed: { readonly maxPerPuzzle: number };
  readonly consolidate: { readonly maxPerPuzzle: number };
}

const nonNegInt = (v: number) => Number.isInteger(v) && v >= 0;
const posInt = (v: number) => Number.isInteger(v) && v > 0;
const unit = (v: number) => v >= 0 && v <= 1;

export function validatePolicyConfig(c: PolicyConfig): string[] {
  const errors: string[] = [];
  if (!c.version) errors.push("version must be a non-empty string");
  if (!nonNegInt(c.maxExtraQuestionsPerPuzzle)) errors.push("maxExtraQuestionsPerPuzzle must be a non-negative integer");
  if (!posInt(c.minFoils)) errors.push("minFoils must be a positive integer");
  if (!nonNegInt(c.focus.maxPerPuzzle)) errors.push("focus.maxPerPuzzle must be a non-negative integer");
  if (!posInt(c.scaffold.recentQuestions)) errors.push("scaffold.recentQuestions must be a positive integer");
  if (!nonNegInt(c.scaffold.maxFirstTryCorrect)) errors.push("scaffold.maxFirstTryCorrect must be a non-negative integer");
  if (!posInt(c.scaffold.foilCount)) errors.push("scaffold.foilCount must be a positive integer");
  if (!posInt(c.tierGate.hardTierFrom)) errors.push("tierGate.hardTierFrom must be a positive integer");
  if (!posInt(c.tierGate.minQuestions)) errors.push("tierGate.minQuestions must be a positive integer");
  if (!unit(c.tierGate.minAccuracy)) errors.push("tierGate.minAccuracy must be between 0 and 1");
  if (!nonNegInt(c.transfer.maxPerPuzzle)) errors.push("transfer.maxPerPuzzle must be a non-negative integer");
  if (!unit(c.transfer.minAccuracy)) errors.push("transfer.minAccuracy must be between 0 and 1");
  if (!nonNegInt(c.review.maxPerPuzzle)) errors.push("review.maxPerPuzzle must be a non-negative integer");
  if (!posInt(c.review.dueAfterMs)) errors.push("review.dueAfterMs must be a positive integer");
  if (!nonNegInt(c.mixed.maxPerPuzzle)) errors.push("mixed.maxPerPuzzle must be a non-negative integer");
  if (!nonNegInt(c.consolidate.maxPerPuzzle)) errors.push("consolidate.maxPerPuzzle must be a non-negative integer");
  if (c.scaffold.foilCount < c.minFoils) errors.push("scaffold.foilCount must be at least minFoils");
  return errors;
}

export function parsePolicyConfig(c: PolicyConfig): PolicyConfig {
  const errors = validatePolicyConfig(c);
  if (errors.length > 0) throw new Error(`Invalid policy config: ${errors.join("; ")}`);
  return c;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_POLICY_CONFIG: PolicyConfig = parsePolicyConfig({
  version: "adaptive-policy/1-provisional",
  provisional: true,
  maxExtraQuestionsPerPuzzle: 3,
  minFoils: 2,
  focus: { maxPerPuzzle: 2 },
  scaffold: { recentQuestions: 3, maxFirstTryCorrect: 1, foilCount: 2 },
  tierGate: { hardTierFrom: 3, minQuestions: 4, minAccuracy: 0.75 },
  transfer: { maxPerPuzzle: 1, minAccuracy: 0.8 },
  review: { maxPerPuzzle: 1, dueAfterMs: DAY_MS },
  mixed: { maxPerPuzzle: 1 },
  consolidate: { maxPerPuzzle: 1 },
});
