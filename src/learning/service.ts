import { tierLookup, type Curriculum, type Item } from "./curriculum";
import { createLearningEvent, newId as defaultNewId, type LearningEvent } from "./events";
import {
  buildPuzzles,
  puzzleStatus,
  starsForMistakes,
  type Puzzle,
  type Status,
} from "./puzzles";
import {
  answer,
  buildQuestion,
  hintFor,
  startQuestion,
  type QuestionState,
  type RandomSource,
} from "./question";

/**
 * The game talks to learning only through this interface. It owns challenge
 * selection, answer validation and learning events. Nothing here depends on
 * React, Three.js, the DOM or the network.
 *
 * A quest is one puzzle (five curriculum words in order). Strategy is the
 * documented default `CONTINUE_SEQUENCE` with presentation `FULL_SET`; the
 * source project's adaptive strategies are not ported yet (PROVENANCE.md).
 */
export interface ChallengeChoice {
  readonly word: string;
}

export interface SpellingChallenge {
  /** Question id; one per shown item. */
  readonly id: string;
  readonly questId: string;
  readonly itemId: string;
  readonly skillId: string;
  readonly level: number;
  /** Needed for audio and the documented reveal fallback; never shown otherwise. */
  readonly targetWord: string;
  readonly choices: readonly ChallengeChoice[];
  /** 0-based position within the quest. */
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly strategy: "CONTINUE_SEQUENCE";
  readonly presentation: "FULL_SET";
  readonly provisional: true;
}

export interface QuestProgress {
  readonly answered: number;
  readonly total: number;
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
  /** Mastery and review decisions; unavailable until the learner model is ported. */
  getMasteryStatus(): MasteryStatus;
  getEvents(): readonly LearningEvent[];
  getContentInfo(): {
    readonly source: string;
    readonly contentVersion: string;
    readonly provisional: boolean;
    readonly items: number;
    readonly levels: number;
  };
  getQuestInfo(questId: string, completedQuestIds: readonly string[]): QuestInfo | null;
}

export interface CurriculumServiceOptions {
  readonly now?: () => number;
  readonly random?: RandomSource;
  readonly newId?: () => string;
  /** Receives every event as it is recorded (e.g. the persistence layer). */
  readonly sink?: (event: LearningEvent) => void;
}

interface Round {
  readonly puzzle: Puzzle;
  readonly items: readonly Item[];
  index: number;
  mistakes: number;
  question: QuestionState | null;
  questionId: string;
}

export function createCurriculumLearningService(
  curriculum: Curriculum,
  options: CurriculumServiceOptions = {},
): LearningService {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const newId = options.newId ?? defaultNewId;
  const sessionId = newId();
  const puzzlesByLevel = buildPuzzles(curriculum);
  const allPuzzles = [...puzzlesByLevel.values()].flat();
  const itemsById = new Map(curriculum.items.map((i) => [i.id, i]));
  const tierOf = tierLookup(curriculum);
  void tierOf; // Used once scaffolding/presentation rules are ported.
  const events: LearningEvent[] = [];
  const rounds = new Map<string, Round>();
  const byQuestionId = new Map<string, string>();

  const record = (event: LearningEvent) => {
    events.push(event);
    options.sink?.(event);
  };

  const toChallenge = (round: Round): SpellingChallenge => {
    const q = round.question;
    if (!q) throw new Error("round has no active question");
    const item = itemsById.get(q.question.itemId);
    if (!item) throw new Error("question item missing");
    return {
      id: round.questionId,
      questId: round.puzzle.id,
      itemId: item.id,
      skillId: item.skillId,
      level: item.level,
      targetWord: item.target,
      choices: q.question.choices.map((c) => ({ word: c.word })),
      questionIndex: round.index,
      questionCount: round.items.length,
      strategy: "CONTINUE_SEQUENCE",
      presentation: "FULL_SET",
      provisional: true,
    };
  };

  const openQuestion = (round: Round) => {
    const item = round.items[round.index];
    if (!item) throw new Error("no item at round index");
    round.question = startQuestion(buildQuestion(item, { random }), now());
    round.questionId = newId();
    byQuestionId.set(round.questionId, round.puzzle.id);
  };

  const progressOf = (round: Round): QuestProgress => ({
    answered: round.index,
    total: round.items.length,
    mistakes: round.mistakes,
  });

  return {
    selectChallenge({ questId, completedQuestIds }) {
      const puzzle = allPuzzles.find((p) => p.id === questId);
      if (!puzzle) return { ok: false, code: "unknown-quest", reason: `No puzzle "${questId}".` };
      const status = puzzleStatus(puzzlesByLevel, puzzle, new Set(completedQuestIds));
      if (status === "locked") {
        return { ok: false, code: "locked", reason: `Puzzle "${questId}" is locked.` };
      }
      const items = puzzle.itemIds.map((id) => itemsById.get(id));
      if (items.some((i) => i === undefined)) {
        return { ok: false, code: "invalid-content", reason: `Puzzle "${questId}" references a missing item.` };
      }
      const round: Round = {
        puzzle,
        items: items as Item[],
        index: 0,
        mistakes: 0,
        question: null,
        questionId: "",
      };
      rounds.set(questId, round);
      openQuestion(round);
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
      if (!round || !round.question || round.questionId !== challengeId) {
        return ignored({ answered: 0, total: 0, mistakes: 0 });
      }
      const item = round.items[round.index];
      if (!item) return ignored(progressOf(round));

      const { state, outcome } = answer(round.question, word, now());
      round.question = state;
      if (outcome.kind === "ignored") return ignored(progressOf(round));

      record(
        createLearningEvent({
          sessionId,
          questionId: round.questionId,
          at: now(),
          contentVersion: curriculum.contentVersion,
          itemId: item.id,
          skillId: item.skillId,
          level: item.level,
          puzzleId: round.puzzle.id,
          presentedFoilCodes: state.question.choices
            .filter((c) => !c.isTarget)
            .map((c) => c.foilCode ?? ""),
          chosenWord: outcome.attempt.word,
          correct: outcome.attempt.correct,
          chosenFoilCode: outcome.attempt.foilCode,
          attemptNumber: outcome.attempt.attemptNumber,
          elapsedMs: outcome.attempt.elapsedMs,
          decisionId: null,
        }, newId()),
      );

      if (outcome.kind === "incorrect") {
        round.mistakes += 1;
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

      round.index += 1;
      if (round.index >= round.items.length) {
        const completion: QuestCompletion = {
          stars: starsForMistakes(round.mistakes),
          mistakes: round.mistakes,
        };
        rounds.delete(round.puzzle.id);
        return {
          correct: true,
          feedbackKey: "correct",
          nextAction: "complete",
          hint: null,
          disabledWords: [],
          progress: progressOf(round),
          nextChallenge: null,
          completion,
        };
      }
      openQuestion(round);
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
          "The learner model and its provisional thresholds have not been ported yet; no mastery claims are made.",
      };
    },

    getEvents: () => events.slice(),

    getContentInfo: () => ({
      source: curriculum.source.file,
      contentVersion: curriculum.contentVersion,
      provisional: true,
      items: curriculum.items.length,
      levels: curriculum.levels.length,
    }),

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
