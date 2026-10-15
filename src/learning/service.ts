import type { Curriculum, Item } from "./curriculum";
import type { AdaptiveDecision } from "./decision";
import { createLearningEvent, newId as defaultNewId, type LearningEvent } from "./events";
import { DEFAULT_LEARNER_MODEL_CONFIG, type LearnerModelConfig } from "./learnerConfig";
import { buildLearnerModel } from "./learnerModel";
import { advanceRound, decideNext, startRound, type RoundState } from "./policy";
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from "./policyConfig";
import { buildPuzzles, levelStatuses, puzzleStatus, starsForMistakes, type Puzzle, type Status } from "./puzzles";
import { answer, buildQuestion, hintFor, startQuestion, type QuestionState } from "./question";
import type { RandomSource } from "./random";
import type { PresentationReason, StrategyReason } from "./reasons";
import { buildProgressReport, type ProgressReport } from "./report";

/**
 * The game talks to learning only through this interface. It owns challenge
 * selection (the adaptive policy), answer validation, learning events and
 * decisions. Nothing here depends on React, Three.js, the DOM or the network.
 *
 * A quest is one puzzle: its new words in curriculum order plus a few
 * policy-chosen extras that never cost stars. The policy and learner-model
 * thresholds are PROVISIONAL (see PROVENANCE.md); every decision says so.
 */
export interface ChallengeChoice {
  readonly word: string;
}

export interface SpellingChallenge {
  /** Question id (= decision id); one per shown item. */
  readonly id: string;
  readonly questId: string;
  readonly itemId: string;
  readonly skillId: string;
  readonly level: number;
  /** Needed for audio and the documented reveal fallback; never shown otherwise. */
  readonly targetWord: string;
  readonly choices: readonly ChallengeChoice[];
  /** The puzzle's own words answered so far and in total. */
  readonly newWordsDone: number;
  readonly newWordsTotal: number;
  readonly strategy: StrategyReason;
  readonly presentation: PresentationReason;
  /** True for policy-chosen practice questions that never cost stars. */
  readonly isExtra: boolean;
  readonly provisional: boolean;
}

export interface QuestProgress {
  readonly newWordsDone: number;
  readonly newWordsTotal: number;
  readonly questionsAsked: number;
  /** Wrong first choices on the puzzle's own words (what stars are based on). */
  readonly mistakes: number;
}

export interface QuestCompletion {
  readonly stars: 1 | 2 | 3;
  readonly mistakes: number;
}

export interface AnswerResult {
  readonly correct: boolean;
  readonly feedbackKey: "correct" | "incorrect-retry" | "ignored";
  readonly nextAction: "next" | "retry" | "complete" | "none";
  /** Child-facing hint after a wrong choice, from the foil codebook mapping. */
  readonly hint: string | null;
  readonly disabledWords: readonly string[];
  readonly progress: QuestProgress;
  readonly nextChallenge: SpellingChallenge | null;
  readonly completion: QuestCompletion | null;
}

export type SelectionFailureCode = "unknown-quest" | "locked" | "invalid-content";

export type ChallengeSelection =
  | { readonly ok: true; readonly challenge: SpellingChallenge }
  | { readonly ok: false; readonly code: SelectionFailureCode; readonly reason: string };

export type MasteryStatus =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

export interface LevelInfo {
  readonly level: number;
  readonly name?: string;
  readonly status: Status;
  readonly puzzleCount: number;
  readonly completedCount: number;
}

export interface QuestInfo {
  readonly questId: string;
  readonly level: number;
  readonly number: number;
  readonly itemCount: number;
  readonly status: Status;
}

export interface LearningService {
  selectChallenge(request: {
    readonly questId: string;
    readonly completedQuestIds: readonly string[];
  }): ChallengeSelection;
  submitAnswer(challengeId: string, word: string): AnswerResult;
  /** The learner left the quest; the round is discarded (no event is recorded). */
  cancelChallenge(challengeId: string): void;
  /** Mastery is never declared; the report's strongest wording is "doing well recently". */
  getMasteryStatus(): MasteryStatus;
  getProgressReport(): ProgressReport;
  getEvents(): readonly LearningEvent[];
  getDecisions(): readonly AdaptiveDecision[];
  getContentInfo(): {
    readonly source: string;
    readonly contentVersion: string;
    readonly provisional: boolean;
    readonly items: number;
    readonly levels: number;
  };
  getQuestInfo(questId: string, completedQuestIds: readonly string[]): QuestInfo | null;
  /** Unlock state and progress of one level (scene). */
  getLevelInfo(level: number, completedQuestIds: readonly string[]): LevelInfo | null;
  /** Every puzzle in curriculum order (for level totals and maps). */
  listPuzzles(): readonly { readonly questId: string; readonly level: number; readonly number: number }[];
}

export interface CurriculumServiceOptions {
  readonly now?: () => number;
  readonly random?: RandomSource;
  readonly newId?: () => string;
  /** Learning events restored from storage, so the learner model has history. */
  readonly history?: readonly LearningEvent[];
  readonly learnerConfig?: LearnerModelConfig;
  readonly policyConfig?: PolicyConfig;
  /** Receives every event as it is recorded (e.g. the persistence layer). */
  readonly sink?: (event: LearningEvent) => void;
  readonly decisionSink?: (decision: AdaptiveDecision) => void;
}

interface Round {
  readonly puzzle: Puzzle;
  state: RoundState;
  mistakes: number;
  questionsAsked: number;
  decision: AdaptiveDecision | null;
  question: QuestionState | null;
}

export function createCurriculumLearningService(
  curriculum: Curriculum,
  options: CurriculumServiceOptions = {},
): LearningService {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const newId = options.newId ?? defaultNewId;
  const learnerConfig = options.learnerConfig ?? DEFAULT_LEARNER_MODEL_CONFIG;
  const policyConfig = options.policyConfig ?? DEFAULT_POLICY_CONFIG;
  const sessionId = newId();
  const puzzlesByLevel = buildPuzzles(curriculum);
  const allPuzzles = [...puzzlesByLevel.values()].flat();
  const itemsById = new Map(curriculum.items.map((i) => [i.id, i]));
  const knownIds = new Set((options.history ?? []).map((e) => e.id));
  const events: LearningEvent[] = [...(options.history ?? [])].sort((a, b) => a.at - b.at);
  const decisions: AdaptiveDecision[] = [];
  const rounds = new Map<string, Round>();
  const byQuestionId = new Map<string, string>();

  const record = (event: LearningEvent) => {
    if (knownIds.has(event.id)) return;
    knownIds.add(event.id);
    events.push(event);
    options.sink?.(event);
  };

  const learner = () => buildLearnerModel(events, curriculum, learnerConfig);

  const toChallenge = (round: Round): SpellingChallenge => {
    const q = round.question;
    const decision = round.decision;
    if (!q || !decision) throw new Error("round has no active question");
    const item = itemsById.get(q.question.itemId);
    if (!item) throw new Error("question item missing");
    return {
      id: decision.id,
      questId: round.puzzle.id,
      itemId: item.id,
      skillId: item.skillId,
      level: item.level,
      targetWord: item.target,
      choices: q.question.choices.map((c) => ({ word: c.word })),
      newWordsDone: round.puzzle.itemIds.length - round.state.queue.length,
      newWordsTotal: round.puzzle.itemIds.length,
      strategy: decision.strategy,
      presentation: decision.presentation,
      isExtra: !decision.countsForStars,
      provisional: decision.provisional,
    };
  };

  /** Asks the policy for the next question; returns false when the puzzle is complete. */
  const openQuestion = (round: Round): boolean => {
    const decision = decideNext({
      curriculum,
      learner: learner(),
      round: round.state,
      config: policyConfig,
      now: now(),
      random,
      newId,
    });
    if (!decision) return false;
    const item = itemsById.get(decision.itemId);
    if (!item) return false;
    const foils = item.foils.filter((f) => decision.foilWords.includes(f.word));
    round.decision = decision;
    round.question = startQuestion(buildQuestion(item, { random, foils }), now());
    round.questionsAsked += 1;
    decisions.push(decision);
    options.decisionSink?.(decision);
    byQuestionId.set(decision.id, round.puzzle.id);
    return true;
  };

  const progressOf = (round: Round): QuestProgress => ({
    newWordsDone: round.puzzle.itemIds.length - round.state.queue.length,
    newWordsTotal: round.puzzle.itemIds.length,
    questionsAsked: round.questionsAsked,
    mistakes: round.mistakes,
  });

  const complete = (round: Round): AnswerResult => {
    rounds.delete(round.puzzle.id);
    return {
      correct: true,
      feedbackKey: "correct",
      nextAction: "complete",
      hint: null,
      disabledWords: [],
      progress: progressOf(round),
      nextChallenge: null,
      completion: { stars: starsForMistakes(round.mistakes), mistakes: round.mistakes },
    };
  };

  return {
    selectChallenge({ questId, completedQuestIds }) {
      const puzzle = allPuzzles.find((p) => p.id === questId);
      if (!puzzle) return { ok: false, code: "unknown-quest", reason: `No puzzle "${questId}".` };
      const status = puzzleStatus(puzzlesByLevel, puzzle, new Set(completedQuestIds));
      if (status === "locked") return { ok: false, code: "locked", reason: `Puzzle "${questId}" is locked.` };
      if (puzzle.itemIds.some((id) => !itemsById.has(id))) {
        return { ok: false, code: "invalid-content", reason: `Puzzle "${questId}" references a missing item.` };
      }
      const round: Round = {
        puzzle,
        state: startRound(puzzle.id, puzzle.level, puzzle.itemIds),
        mistakes: 0,
        questionsAsked: 0,
        decision: null,
        question: null,
      };
      if (!openQuestion(round)) {
        return { ok: false, code: "invalid-content", reason: `Puzzle "${questId}" has no questions.` };
      }
      rounds.set(questId, round);
      return { ok: true, challenge: toChallenge(round) };
    },

    submitAnswer(challengeId, word) {
      const questId = byQuestionId.get(challengeId);
      const round = questId ? rounds.get(questId) : undefined;
      const ignored = (progress: QuestProgress): AnswerResult => ({
        correct: false,
        feedbackKey: "ignored",
        nextAction: "none",
        hint: null,
        disabledWords: round?.question?.disabledWords ?? [],
        progress,
        nextChallenge: null,
        completion: null,
      });
      if (!round || !round.question || !round.decision || round.decision.id !== challengeId) {
        return ignored({ newWordsDone: 0, newWordsTotal: 0, questionsAsked: 0, mistakes: 0 });
      }
      const decision = round.decision;
      const item: Item | undefined = itemsById.get(decision.itemId);
      if (!item) return ignored(progressOf(round));

      const { state, outcome } = answer(round.question, word, now());
      round.question = state;
      if (outcome.kind === "ignored") return ignored(progressOf(round));

      record(
        createLearningEvent(
          {
            sessionId,
            questionId: decision.id,
            at: now(),
            contentVersion: curriculum.contentVersion,
            itemId: item.id,
            skillId: item.skillId,
            level: item.level,
            puzzleId: round.puzzle.id,
            presentedFoilCodes: decision.foilCodes,
            chosenWord: outcome.attempt.word,
            correct: outcome.attempt.correct,
            chosenFoilCode: outcome.attempt.foilCode,
            attemptNumber: outcome.attempt.attemptNumber,
            elapsedMs: outcome.attempt.elapsedMs,
            decisionId: decision.id,
          },
          newId(),
        ),
      );

      if (outcome.kind === "incorrect") {
        if (decision.countsForStars) round.mistakes += 1;
        return {
          correct: false,
          feedbackKey: "incorrect-retry",
          nextAction: "retry",
          hint: hintFor(outcome.attempt.foilCode),
          disabledWords: state.disabledWords,
          progress: progressOf(round),
          nextChallenge: null,
          completion: null,
        };
      }

      const firstTryCorrect = state.attempts[0]?.correct ?? false;
      round.state = advanceRound(round.state, decision, firstTryCorrect);
      if (!openQuestion(round)) return complete(round);
      return {
        correct: true,
        feedbackKey: "correct",
        nextAction: "next",
        hint: null,
        disabledWords: [],
        progress: progressOf(round),
        nextChallenge: toChallenge(round),
        completion: null,
      };
    },

    cancelChallenge(challengeId) {
      const questId = byQuestionId.get(challengeId);
      if (questId) rounds.delete(questId);
    },

    getMasteryStatus() {
      return {
        available: false,
        reason:
          "Mastery is never declared. The learner model and policy thresholds are provisional; see the progress report for evidence-based wording.",
      };
    },

    getProgressReport: () => buildProgressReport(learner(), curriculum, policyConfig),
    getEvents: () => events.slice(),
    getDecisions: () => decisions.slice(),

    getContentInfo: () => ({
      source: curriculum.source.file,
      contentVersion: curriculum.contentVersion,
      provisional: learnerConfig.provisional || policyConfig.provisional,
      items: curriculum.items.length,
      levels: curriculum.levels.length,
    }),

    listPuzzles: () => allPuzzles.map((p) => ({ questId: p.id, level: p.level, number: p.number })),

    getLevelInfo(level, completedQuestIds) {
      const puzzles = puzzlesByLevel.get(level);
      if (!puzzles) return null;
      const completed = new Set(completedQuestIds);
      return {
        level,
        status: levelStatuses(puzzlesByLevel, completed).get(level) ?? "locked",
        puzzleCount: puzzles.length,
        completedCount: puzzles.filter((p) => completed.has(p.id)).length,
      };
    },

    getQuestInfo(questId, completedQuestIds) {
      const puzzle = allPuzzles.find((p) => p.id === questId);
      if (!puzzle) return null;
      return {
        questId,
        level: puzzle.level,
        number: puzzle.number,
        itemCount: puzzle.itemIds.length,
        status: puzzleStatus(puzzlesByLevel, puzzle, new Set(completedQuestIds)),
      };
    },
  };
}
