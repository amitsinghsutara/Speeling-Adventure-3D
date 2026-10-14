import type {
  AnswerResult,
  LearningService,
  SelectionFailureCode,
  SpellingChallenge,
} from "@/learning/service";
import type { WorldInteractable } from "./interactables";
import { EMPTY_REWARDS, grantReward, starRewardId, type GameRewards } from "./rewards";

/**
 * Explicit quest phases (plan §3): idle → available → active → completed,
 * with cancel and error paths. `available` means an interactable is in range.
 * A quest is one curriculum puzzle: several questions answered in sequence.
 */
export type QuestPhase = "idle" | "available" | "active" | "completed" | "error";

export interface QuestState {
  readonly phase: QuestPhase;
  readonly nearbyInteractable: WorldInteractable | null;
  readonly questId: string | null;
  readonly challenge: SpellingChallenge | null;
  /** Wrong choices so far in this quest. */
  readonly mistakes: number;
  readonly lastResult: AnswerResult | null;
  /** True right after a correct answer, until `advance` shows the next question. */
  readonly celebrating: boolean;
  readonly error: string | null;
  readonly errorCode: SelectionFailureCode | null;
  /** Stars earned by the just-completed quest. */
  readonly starsEarned: number;
  /** How many of those stars were new (not already collected). */
  readonly newStars: number;
  readonly completedQuestIds: readonly string[];
  readonly rewards: GameRewards;
}

export const INITIAL_QUEST_STATE: QuestState = {
  phase: "idle",
  nearbyInteractable: null,
  questId: null,
  challenge: null,
  mistakes: 0,
  lastResult: null,
  celebrating: false,
  error: null,
  errorCode: null,
  starsEarned: 0,
  newStars: 0,
  completedQuestIds: [],
  rewards: EMPTY_REWARDS,
};

export type QuestEvent =
  | { readonly type: "proximity"; readonly interactable: WorldInteractable | null }
  | { readonly type: "challenge-loaded"; readonly questId: string; readonly challenge: SpellingChallenge }
  | {
      readonly type: "challenge-unavailable";
      readonly questId: string;
      readonly code: SelectionFailureCode;
      readonly reason: string;
    }
  | { readonly type: "answered"; readonly result: AnswerResult }
  | { readonly type: "advanced" }
  | { readonly type: "cancelled" }
  | { readonly type: "dismissed" };

function restingPhase(state: QuestState): QuestPhase {
  return state.nearbyInteractable ? "available" : "idle";
}

function resting(state: QuestState): QuestState {
  return {
    ...state,
    phase: restingPhase(state),
    questId: null,
    challenge: null,
    mistakes: 0,
    lastResult: null,
    celebrating: false,
    error: null,
    errorCode: null,
    starsEarned: 0,
    newStars: 0,
  };
}

/** Pure transition function; side effects live in the controller. */
export function questReducer(state: QuestState, event: QuestEvent): QuestState {
  switch (event.type) {
    case "proximity": {
      const next = { ...state, nearbyInteractable: event.interactable };
      if (state.phase === "idle" || state.phase === "available") {
        return { ...next, phase: restingPhase(next) };
      }
      return next;
    }
    case "challenge-loaded":
      return {
        ...resting(state),
        phase: "active",
        questId: event.questId,
        challenge: event.challenge,
      };
    case "challenge-unavailable":
      return {
        ...resting(state),
        phase: "error",
        questId: event.questId,
        error: event.reason,
        errorCode: event.code,
      };
    case "answered": {
      if (state.phase !== "active" || !state.questId) return state;
      const result = event.result;
      if (result.feedbackKey === "ignored") return state;
      if (!result.correct) {
        return { ...state, mistakes: result.progress.mistakes, lastResult: result };
      }
      if (result.completion) {
        let rewards = state.rewards;
        let newStars = 0;
        for (let n = 1; n <= result.completion.stars; n += 1) {
          const granted = grantReward(rewards, starRewardId(state.questId, n));
          rewards = granted.rewards;
          if (granted.granted) newStars += 1;
        }
        return {
          ...state,
          phase: "completed",
          mistakes: result.progress.mistakes,
          lastResult: result,
          celebrating: false,
          starsEarned: result.completion.stars,
          newStars,
          rewards,
          completedQuestIds: state.completedQuestIds.includes(state.questId)
            ? state.completedQuestIds
            : [...state.completedQuestIds, state.questId],
        };
      }
      // Correct with more questions to come: celebrate, then advance.
      return { ...state, mistakes: result.progress.mistakes, lastResult: result, celebrating: true };
    }
    case "advanced": {
      if (state.phase !== "active" || !state.celebrating) return state;
      const next = state.lastResult?.nextChallenge ?? state.challenge;
      return { ...state, challenge: next, celebrating: false, lastResult: null };
    }
    case "cancelled":
    case "dismissed":
      return resting(state);
    default:
      return state;
  }
}

export interface QuestController {
  getState(): QuestState;
  subscribe(listener: () => void): () => void;
  setProximity(interactable: WorldInteractable | null): void;
  /** Interact intent (key or button). Starts the nearby quest when available. */
  interact(): boolean;
  submitAnswer(word: string): AnswerResult | null;
  /** Shows the next question after a correct answer. */
  advance(): void;
  cancel(): void;
  dismiss(): void;
}

export function createQuestController(
  service: LearningService,
  initial: QuestState = INITIAL_QUEST_STATE,
): QuestController {
  let state = initial;
  const listeners = new Set<() => void>();

  const dispatch = (event: QuestEvent) => {
    const next = questReducer(state, event);
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setProximity(interactable) {
      if (state.nearbyInteractable?.id === interactable?.id) return;
      dispatch({ type: "proximity", interactable });
    },
    interact() {
      if (state.phase !== "available" || !state.nearbyInteractable?.questId) return false;
      const questId = state.nearbyInteractable.questId;
      const selection = service.selectChallenge({
        questId,
        completedQuestIds: state.completedQuestIds,
      });
      if (selection.ok) {
        dispatch({ type: "challenge-loaded", questId, challenge: selection.challenge });
      } else {
        dispatch({
          type: "challenge-unavailable",
          questId,
          code: selection.code,
          reason: selection.reason,
        });
      }
      return true;
    },
    submitAnswer(word) {
      if (state.phase !== "active" || !state.challenge || state.celebrating) return null;
      const result = service.submitAnswer(state.challenge.id, word);
      dispatch({ type: "answered", result });
      return result;
    },
    advance() {
      dispatch({ type: "advanced" });
    },
    cancel() {
      if (state.phase === "active" && state.challenge) {
        service.cancelChallenge(state.challenge.id);
      }
      if (state.phase === "active" || state.phase === "error") dispatch({ type: "cancelled" });
    },
    dismiss() {
      if (state.phase === "completed" || state.phase === "error") dispatch({ type: "dismissed" });
    },
  };
}
