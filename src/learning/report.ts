/**
 * The grown-ups' progress report: plain-language facts from the local
 * learner model. Deterministic and on-device; no AI. It never claims mastery:
 * the strongest wording is "doing well recently", and only with enough
 * evidence. Ported from the source project (PROVENANCE.md).
 */
import type { Curriculum } from "./curriculum";
import type { LearnerModel } from "./learnerModel";
import type { PolicyConfig } from "./policyConfig";

export type LevelStatus = "not-started" | "just-started" | "practising" | "doing-well";

export interface LevelReport {
  readonly level: number;
  readonly skillPattern: string;
  readonly questions: number;
  readonly firstTryAccuracy: number | null;
  readonly recentAccuracy: number | null;
  readonly status: LevelStatus;
}

export interface TrickySpot {
  readonly code: string;
  /** FoilCodebook name, e.g. "Vowel substitution". */
  readonly name: string;
  /** FoilCodebook example, e.g. "cat > cot". */
  readonly example: string;
  /** Times the child picked this kind of wrong answer, of the times it was on screen. */
  readonly chosen: number;
  readonly presentedIn: number;
}

export interface ProgressReport {
  readonly questions: number;
  readonly wordsPractised: number;
  readonly firstTryAccuracy: number | null;
  readonly levels: readonly LevelReport[];
  readonly trickySpots: readonly TrickySpot[];
  /** Words not right first time on their latest try, most recent first. */
  readonly practiseWords: readonly string[];
  /** True while the thresholds behind this report are unconfirmed. */
  readonly provisional: boolean;
}

export const MAX_PRACTISE_WORDS = 10;

export function levelStatus(
  questions: number,
  recentAccuracy: number | null,
  evidence: "none" | "insufficient" | "enough",
  doingWellAt: number,
): LevelStatus {
  if (questions === 0 || evidence === "none") return "not-started";
  if (evidence === "insufficient") return "just-started";
  return recentAccuracy !== null && recentAccuracy >= doingWellAt ? "doing-well" : "practising";
}

export function buildProgressReport(
  learner: LearnerModel,
  curriculum: Curriculum,
  policy: PolicyConfig,
): ProgressReport {
  const codebook = new Map(curriculum.foilCodebook.map((e) => [e.code, e]));
  const items = new Map(curriculum.items.map((i) => [i.id, i]));
  const firstTry = learner.questions.filter((q) => q.firstTryCorrect).length;

  const levels = curriculum.levels.map((level): LevelReport => {
    const stats = learner.bySkill.get(level.skillId);
    const questions = stats?.questions ?? 0;
    return {
      level: level.level,
      skillPattern: level.skillPattern,
      questions,
      firstTryAccuracy: stats?.firstTryAccuracy ?? null,
      recentAccuracy: stats?.recentFirstTryAccuracy ?? null,
      // "Doing well" uses the same readiness bar as the transfer check, so the
      // report and the game's own behaviour agree.
      status: levelStatus(
        questions,
        stats?.recentFirstTryAccuracy ?? null,
        stats?.evidence ?? "none",
        policy.transfer.minAccuracy,
      ),
    };
  });

  const trickySpots = learner.errorPatterns.flatMap((pattern): TrickySpot[] => {
    const entry = codebook.get(pattern.foilCode);
    const stats = learner.byFoilType.get(pattern.foilCode);
    if (!entry || !stats) return [];
    return [
      { code: entry.code, name: entry.name, example: entry.example, chosen: stats.chosen, presentedIn: stats.presentedIn },
    ];
  });

  const practiseWords = [...learner.byItem.values()]
    .filter((s) => !s.lastFirstTryCorrect)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .flatMap((s) => {
      const target = items.get(s.itemId)?.target;
      return target ? [target] : [];
    })
    .slice(0, MAX_PRACTISE_WORDS);

  return {
    questions: learner.questions.length,
    wordsPractised: learner.byItem.size,
    firstTryAccuracy: learner.questions.length === 0 ? null : firstTry / learner.questions.length,
    levels,
    trickySpots,
    practiseWords,
    provisional: learner.provisional || policy.provisional,
  };
}

export const STATUS_TEXT: Readonly<Record<LevelStatus, string>> = {
  "not-started": "Not started",
  "just-started": "Just getting started (not enough answers yet to say more)",
  practising: "Still practising",
  "doing-well": "Doing well recently",
};

export const percent = (value: number | null): string =>
  value === null ? "n/a" : `${Math.round(value * 100)}%`;
