/**
 * The learner model: statistics derived purely from learning events.
 * Same events + curriculum + config always give the same model, so adaptive
 * decisions made from it can be explained and replayed. Ported from the
 * source project (PROVENANCE.md).
 */
import type { Curriculum } from "./curriculum";
import type { LearningEvent } from "./events";
import type { LearnerModelConfig } from "./learnerConfig";

/** All attempts at one shown question. */
export interface QuestionRecord {
  readonly questionId: string;
  readonly itemId: string;
  readonly skillId: string;
  readonly level: number;
  /** Time of the first attempt. */
  readonly at: number;
  readonly presentedFoilCodes: readonly string[];
  readonly attempts: readonly LearningEvent[];
  readonly firstTryCorrect: boolean;
  readonly solved: boolean;
}

export type Evidence = "none" | "insufficient" | "enough";

export interface SkillStats {
  readonly skillId: string;
  readonly level: number;
  readonly questions: number;
  readonly firstTryCorrect: number;
  /** Null until at least one question; read together with `evidence`. */
  readonly firstTryAccuracy: number | null;
  /** Accuracy over the most recent `errorPattern.windowQuestions` questions. */
  readonly recentFirstTryAccuracy: number | null;
  readonly distinctItems: number;
  readonly lastSeenAt: number | null;
  readonly evidence: Evidence;
}

export interface FoilTypeStats {
  readonly code: string;
  readonly tier: number | null;
  /** Questions in which this foil type was on screen. */
  presentedIn: number;
  /** Times the child picked a foil of this type (per `firstChoiceOnly`). */
  chosen: number;
  errorRate: number | null;
}

export interface ItemStats {
  readonly itemId: string;
  readonly timesSeen: number;
  readonly firstTryCorrect: number;
  readonly lastSeenAt: number;
  readonly lastFirstTryCorrect: boolean;
}

export interface ErrorPattern {
  readonly foilCode: string;
  readonly errors: number;
  readonly questionsInWindow: number;
  readonly distinctItems: number;
  readonly errorRate: number;
  /** The events that make up the evidence, so a decision can cite them. */
  readonly evidenceEventIds: readonly string[];
}

export interface LearnerModel {
  readonly configVersion: string;
  readonly provisional: boolean;
  readonly questions: readonly QuestionRecord[];
  readonly bySkill: ReadonlyMap<string, SkillStats>;
  readonly byFoilType: ReadonlyMap<string, FoilTypeStats>;
  readonly byItem: ReadonlyMap<string, ItemStats>;
  readonly errorPatterns: readonly ErrorPattern[];
  /** Events left out because their item is no longer in the curriculum. */
  readonly ignoredEvents: number;
}

const ratio = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

export function groupQuestions(events: readonly LearningEvent[]): QuestionRecord[] {
  const byQuestion = new Map<string, LearningEvent[]>();
  for (const event of events) {
    const list = byQuestion.get(event.questionId);
    if (list) list.push(event);
    else byQuestion.set(event.questionId, [event]);
  }
  const records: QuestionRecord[] = [];
  for (const [questionId, list] of byQuestion) {
    const attempts = [...list].sort((a, b) => a.attemptNumber - b.attemptNumber || a.at - b.at);
    const first = attempts[0];
    if (!first) continue;
    records.push({
      questionId,
      itemId: first.itemId,
      skillId: first.skillId,
      level: first.level,
      at: first.at,
      presentedFoilCodes: first.presentedFoilCodes,
      attempts,
      firstTryCorrect: first.attemptNumber === 1 && first.correct,
      solved: attempts.some((a) => a.correct),
    });
  }
  return records.sort((a, b) => a.at - b.at || a.questionId.localeCompare(b.questionId));
}

/** Wrong choices in a question that count as evidence, per config. */
const countedErrors = (q: QuestionRecord, config: LearnerModelConfig): LearningEvent[] =>
  q.attempts.filter((a) => !a.correct && (!config.firstChoiceOnly || a.attemptNumber === 1));

function skillStats(questions: readonly QuestionRecord[], config: LearnerModelConfig): Map<string, SkillStats> {
  const bySkill = new Map<string, QuestionRecord[]>();
  for (const q of questions) {
    const list = bySkill.get(q.skillId);
    if (list) list.push(q);
    else bySkill.set(q.skillId, [q]);
  }
  const result = new Map<string, SkillStats>();
  for (const [skillId, list] of bySkill) {
    const firstTryCorrect = list.filter((q) => q.firstTryCorrect).length;
    const recent = list.slice(-config.errorPattern.windowQuestions);
    result.set(skillId, {
      skillId,
      level: list[0]?.level ?? 0,
      questions: list.length,
      firstTryCorrect,
      firstTryAccuracy: ratio(firstTryCorrect, list.length),
      recentFirstTryAccuracy: ratio(recent.filter((q) => q.firstTryCorrect).length, recent.length),
      distinctItems: new Set(list.map((q) => q.itemId)).size,
      lastSeenAt: list.at(-1)?.at ?? null,
      evidence:
        list.length === 0 ? "none" : list.length < config.minQuestionsForEvidence ? "insufficient" : "enough",
    });
  }
  return result;
}

function foilTypeStats(
  questions: readonly QuestionRecord[],
  curriculum: Curriculum,
  config: LearnerModelConfig,
): Map<string, FoilTypeStats> {
  const result = new Map<string, FoilTypeStats>();
  for (const entry of curriculum.foilCodebook) {
    result.set(entry.code, { code: entry.code, tier: entry.tier, presentedIn: 0, chosen: 0, errorRate: null });
  }
  for (const q of questions) {
    for (const code of new Set(q.presentedFoilCodes)) {
      const stats = result.get(code) ?? { code, tier: null, presentedIn: 0, chosen: 0, errorRate: null };
      stats.presentedIn += 1;
      result.set(code, stats);
    }
    for (const error of countedErrors(q, config)) {
      const code = error.chosenFoilCode;
      const stats = code === null ? undefined : result.get(code);
      if (stats) stats.chosen += 1;
    }
  }
  for (const stats of result.values()) stats.errorRate = ratio(stats.chosen, stats.presentedIn);
  return result;
}

function itemStats(questions: readonly QuestionRecord[]): Map<string, ItemStats> {
  const result = new Map<string, ItemStats>();
  for (const q of questions) {
    const previous = result.get(q.itemId);
    result.set(q.itemId, {
      itemId: q.itemId,
      timesSeen: (previous?.timesSeen ?? 0) + 1,
      firstTryCorrect: (previous?.firstTryCorrect ?? 0) + (q.firstTryCorrect ? 1 : 0),
      lastSeenAt: q.at,
      lastFirstTryCorrect: q.firstTryCorrect,
    });
  }
  return result;
}

/**
 * A foil type is an error pattern only with repeated evidence: in the most
 * recent questions that showed it, the child picked it at least `minErrors`
 * times, across at least `minDistinctItems` different words, at or above
 * `minErrorRate`.
 */
export function detectErrorPatterns(
  questions: readonly QuestionRecord[],
  config: LearnerModelConfig,
): ErrorPattern[] {
  const { windowQuestions, minErrors, minDistinctItems, minErrorRate } = config.errorPattern;
  const codes = new Set(questions.flatMap((q) => q.presentedFoilCodes));
  const patterns: ErrorPattern[] = [];
  for (const code of [...codes].sort()) {
    const window = questions.filter((q) => q.presentedFoilCodes.includes(code)).slice(-windowQuestions);
    const errorEvents = window.flatMap((q) =>
      countedErrors(q, config).filter((e) => e.chosenFoilCode === code),
    );
    const errorQuestions = new Set(errorEvents.map((e) => e.questionId)).size;
    const distinctItems = new Set(errorEvents.map((e) => e.itemId)).size;
    const errorRate = window.length === 0 ? 0 : errorQuestions / window.length;
    if (errorEvents.length >= minErrors && distinctItems >= minDistinctItems && errorRate >= minErrorRate) {
      patterns.push({
        foilCode: code,
        errors: errorEvents.length,
        questionsInWindow: window.length,
        distinctItems,
        errorRate,
        evidenceEventIds: errorEvents.map((e) => e.id),
      });
    }
  }
  return patterns;
}

export function buildLearnerModel(
  events: readonly LearningEvent[],
  curriculum: Curriculum,
  config: LearnerModelConfig,
): LearnerModel {
  const knownItems = new Set(curriculum.items.map((i) => i.id));
  const usable = events.filter((e) => knownItems.has(e.itemId));
  const questions = groupQuestions(usable);
  return {
    configVersion: config.version,
    provisional: config.provisional,
    questions,
    bySkill: skillStats(questions, config),
    byFoilType: foilTypeStats(questions, curriculum, config),
    byItem: itemStats(questions),
    errorPatterns: detectErrorPatterns(questions, config),
    ignoredEvents: events.length - usable.length,
  };
}
