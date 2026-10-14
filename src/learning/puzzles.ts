/**
 * Levels are split into puzzles in dataset sequence order. Puzzles unlock one
 * after another, and a level unlocks once every puzzle of the previous level
 * is complete. Star rules: 0 mistakes → 3, 1–3 → 2, 4+ → 1; replays never
 * lower a stored result. Ported from the source project (PROVENANCE.md).
 */
import { itemsForLevel, type Curriculum } from "./curriculum";

export const PUZZLES_PER_LEVEL = 5;
export const MAX_STARS = 3;

export interface Puzzle {
  /** Stable key for saved progress, e.g. "level-2/puzzle-3". */
  readonly id: string;
  readonly level: number;
  /** 1-based within the level. */
  readonly number: number;
  readonly itemIds: readonly string[];
}

export type Status = "locked" | "available" | "completed";

/** Splits items into up to `count` groups as evenly as possible; earlier groups take the remainder. */
export function chunk<T>(items: readonly T[], count: number): T[][] {
  if (items.length === 0) return [];
  const n = Math.max(1, Math.min(count, items.length));
  const base = Math.floor(items.length / n);
  const remainder = items.length % n;
  const result: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < n; i += 1) {
    const size = base + (i < remainder ? 1 : 0);
    result.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return result;
}

export const puzzleId = (level: number, number: number): string =>
  `level-${level}/puzzle-${number}`;

export function buildPuzzles(
  curriculum: Curriculum,
  perLevel = PUZZLES_PER_LEVEL,
): Map<number, Puzzle[]> {
  const byLevel = new Map<number, Puzzle[]>();
  for (const { level } of curriculum.levels) {
    const puzzles = chunk(itemsForLevel(curriculum, level), perLevel).map((items, i) => ({
      id: puzzleId(level, i + 1),
      level,
      number: i + 1,
      itemIds: items.map((item) => item.id),
    }));
    byLevel.set(level, puzzles);
  }
  return byLevel;
}

const isLevelComplete = (puzzles: readonly Puzzle[], completed: ReadonlySet<string>): boolean =>
  puzzles.length > 0 && puzzles.every((p) => completed.has(p.id));

export function levelStatuses(
  puzzlesByLevel: ReadonlyMap<number, readonly Puzzle[]>,
  completed: ReadonlySet<string>,
): Map<number, Status> {
  const statuses = new Map<number, Status>();
  let previousComplete = true;
  for (const level of [...puzzlesByLevel.keys()].sort((a, b) => a - b)) {
    const complete = isLevelComplete(puzzlesByLevel.get(level) ?? [], completed);
    statuses.set(level, complete ? "completed" : previousComplete ? "available" : "locked");
    previousComplete = complete;
  }
  return statuses;
}

export function puzzleStatuses(
  puzzles: readonly Puzzle[],
  completed: ReadonlySet<string>,
  levelStatus: Status,
): Map<string, Status> {
  const statuses = new Map<string, Status>();
  let previousComplete = levelStatus !== "locked";
  for (const puzzle of puzzles) {
    const complete = completed.has(puzzle.id);
    statuses.set(puzzle.id, complete ? "completed" : previousComplete ? "available" : "locked");
    previousComplete = complete;
  }
  return statuses;
}

/** Status of one puzzle given the set of completed puzzle ids. */
export function puzzleStatus(
  puzzlesByLevel: ReadonlyMap<number, readonly Puzzle[]>,
  puzzle: Puzzle,
  completed: ReadonlySet<string>,
): Status {
  const levelStatus = levelStatuses(puzzlesByLevel, completed).get(puzzle.level) ?? "locked";
  return (
    puzzleStatuses(puzzlesByLevel.get(puzzle.level) ?? [], completed, levelStatus).get(puzzle.id) ??
    "locked"
  );
}

/** 0 mistakes → 3 stars, 1–3 → 2, 4 or more → 1. Completing always earns at least 1. */
export function starsForMistakes(mistakes: number): 1 | 2 | 3 {
  if (mistakes <= 0) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}

/** A replay never lowers a stored result. */
export const bestStars = (previous: number | undefined, next: number): number =>
  Math.max(previous ?? 0, next);
