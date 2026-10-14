/**
 * One question: the child hears the target and picks it among the target and
 * the item's own approved foils. A wrong tile is disabled and counted once;
 * the question ends on the target. Ported from the source project.
 */
import type { Foil, Item } from "./curriculum";

export type RandomSource = () => number;

export interface Choice {
  readonly word: string;
  readonly isTarget: boolean;
  /** FoilCodebook code; absent on the target. Never shown to the child. */
  readonly foilCode?: string;
}

export interface Question {
  readonly itemId: string;
  readonly target: string;
  readonly choices: readonly Choice[];
}

export class InvalidQuestionError extends Error {
  override name = "InvalidQuestionError";
}

export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

export interface BuildQuestionOptions {
  readonly random: RandomSource;
  /** Foils to present (scaffolding may show fewer). Each must be one of the item's own. */
  readonly foils?: readonly Foil[];
}

export function buildQuestion(item: Item, { random, foils = item.foils }: BuildQuestionOptions): Question {
  if (foils.length === 0) throw new InvalidQuestionError(`${item.id}: at least one foil is required`);
  const seen = new Set<string>();
  for (const foil of foils) {
    const approved = item.foils.some((f) => f.word === foil.word && f.code === foil.code);
    if (!approved) {
      throw new InvalidQuestionError(`${item.id}: "${foil.word}" is not an approved foil for this item`);
    }
    if (seen.has(foil.word)) throw new InvalidQuestionError(`${item.id}: foil "${foil.word}" is repeated`);
    seen.add(foil.word);
  }
  const choices: Choice[] = [
    { word: item.target, isTarget: true },
    ...foils.map((f) => ({ word: f.word, isTarget: false, foilCode: f.code })),
  ];
  return { itemId: item.id, target: item.target, choices: shuffle(choices, random) };
}

export interface Attempt {
  readonly word: string;
  readonly correct: boolean;
  readonly foilCode?: string;
  /** 1-based attempt number within this question. */
  readonly attemptNumber: number;
  /** Milliseconds since the question was shown. */
  readonly elapsedMs: number;
}

export interface QuestionState {
  readonly question: Question;
  readonly shownAt: number;
  readonly status: "awaiting" | "retry" | "correct";
  readonly disabledWords: readonly string[];
  readonly attempts: readonly Attempt[];
}

export type AnswerOutcome =
  | { readonly kind: "correct"; readonly attempt: Attempt }
  | { readonly kind: "incorrect"; readonly attempt: Attempt }
  | { readonly kind: "ignored"; readonly reason: "already-correct" | "already-tried" | "not-a-choice" };

export const startQuestion = (question: Question, now: number): QuestionState => ({
  question,
  shownAt: now,
  status: "awaiting",
  disabledWords: [],
  attempts: [],
});

export function answer(
  state: QuestionState,
  word: string,
  now: number,
): { state: QuestionState; outcome: AnswerOutcome } {
  if (state.status === "correct") return { state, outcome: { kind: "ignored", reason: "already-correct" } };
  if (state.disabledWords.includes(word)) return { state, outcome: { kind: "ignored", reason: "already-tried" } };
  const choice = state.question.choices.find((c) => c.word === word);
  if (!choice) return { state, outcome: { kind: "ignored", reason: "not-a-choice" } };

  const attempt: Attempt = {
    word,
    correct: choice.isTarget,
    ...(choice.foilCode !== undefined ? { foilCode: choice.foilCode } : {}),
    attemptNumber: state.attempts.length + 1,
    elapsedMs: Math.max(0, now - state.shownAt),
  };
  const attempts = [...state.attempts, attempt];
  if (choice.isTarget) {
    return { state: { ...state, status: "correct", attempts }, outcome: { kind: "correct", attempt } };
  }
  return {
    state: { ...state, status: "retry", attempts, disabledWords: [...state.disabledWords, word] },
    outcome: { kind: "incorrect", attempt },
  };
}

export const mistakesIn = (state: QuestionState): number =>
  state.attempts.filter((a) => !a.correct).length;

/**
 * Child-facing hints after a wrong choice, keyed by FoilCodebook code
 * (wording ported from the source project). Codes are never shown.
 */
const HINTS: Readonly<Record<string, string>> = {
  IC: "Listen to the first sound.",
  FC: "Listen to the last sound.",
  V: "Listen to the middle sound.",
  VIS: "Look closely at the letter shapes.",
  OM: "Listen carefully. You might be missing a sound.",
  DIG: "Listen closely. Two letters team up to make that sound.",
  TR: "Check the order of the letters.",
  PH: "That sounds right, but it is spelled another way. Look again!",
  REG: "This word is a little different. It does not follow the usual pattern.",
  OVR: "Check the spelling pattern carefully.",
  DBL: "Check if a letter should appear twice.",
  INS: "Listen carefully. There might be an extra sound.",
  "L1-RL": "Listen closely. Is it r or l?",
  "L1-VD": "Listen closely to the last sound.",
  "L1-PRO": "Listen. The word does not start with an extra sound.",
  "L1-EPN": "Listen. There is no extra sound in the middle.",
  "L1-TH": "Listen closely to the 'th' sound.",
  "L1-VOW": "Listen closely to the vowel sound.",
};

export const DEFAULT_HINT = "Listen again and try once more.";

export const hintFor = (foilCode: string | undefined): string =>
  (foilCode !== undefined ? HINTS[foilCode] : undefined) ?? DEFAULT_HINT;
