/**
 * Runtime contract for the imported curriculum dataset. The shape mirrors the
 * source project's `src/content/schema.ts` (see content/PROVENANCE.md). The
 * bundled JSON is re-validated on load so a stale or hand-edited file fails
 * loudly instead of misbehaving in play. No external schema library is used.
 */
export const CURRICULUM_SCHEMA_VERSION = 1 as const;
export const L1_TRANSFER_CODE_PREFIX = "L1-";

export interface Foil {
  readonly word: string;
  /** Raw FoilCodebook code; its meaning lives in the codebook, never in code. */
  readonly code: string;
}

export interface FoilCodebookEntry {
  readonly code: string;
  readonly name: string;
  readonly definition: string;
  readonly example: string;
  readonly probe: string;
  readonly tier: number;
  readonly tierLabel: string;
  readonly isL1Transfer: boolean;
}

export interface Level {
  readonly level: number;
  readonly skillId: string;
  readonly skillPattern: string;
  readonly targetWordCount: number;
  /** Reviewer-facing only. Never shown to children. */
  readonly foilDesignLogic: string;
  readonly researchRationale: string;
}

export interface Item {
  readonly id: string;
  readonly sourceRow: number;
  readonly level: number;
  readonly itemNumber: number;
  readonly sequenceInLevel: number;
  readonly skillId: string;
  readonly skillPattern: string;
  readonly target: string;
  readonly foils: readonly Foil[];
  readonly realWordFoilCount: number;
  readonly l1TransferFoilCount: number;
  readonly designNote: string | null;
}

export interface Curriculum {
  readonly schemaVersion: typeof CURRICULUM_SCHEMA_VERSION;
  readonly contentVersion: string;
  readonly source: { readonly file: string; readonly sha256: string };
  readonly levels: readonly Level[];
  readonly foilCodebook: readonly FoilCodebookEntry[];
  readonly items: readonly Item[];
  readonly researchNotes: readonly string[];
}

export class CurriculumError extends Error {
  override name = "CurriculumError";
}

const WORD = /^[a-z]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ITEM_ID = /^item-\d{3,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new CurriculumError(`Curriculum dataset is invalid at "${path}": ${message}`);
}

function str(raw: Record<string, unknown>, key: string, path: string, min = 1): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length < min) fail(`${path}.${key}`, "expected a non-empty string");
  return value;
}

function int(raw: Record<string, unknown>, key: string, path: string, min: number, max = Number.POSITIVE_INFINITY): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(`${path}.${key}`, `expected an integer between ${min} and ${max}`);
  }
  return value;
}

function bool(raw: Record<string, unknown>, key: string, path: string): boolean {
  const value = raw[key];
  if (typeof value !== "boolean") fail(`${path}.${key}`, "expected a boolean");
  return value;
}

function word(raw: Record<string, unknown>, key: string, path: string): string {
  const value = str(raw, key, path);
  if (!WORD.test(value)) fail(`${path}.${key}`, "must be lowercase letters a-z");
  return value;
}

function parseFoil(raw: unknown, path: string): Foil {
  if (!isRecord(raw)) fail(path, "expected an object");
  return { word: word(raw, "word", path), code: str(raw, "code", path) };
}

function parseCodebookEntry(raw: unknown, path: string): FoilCodebookEntry {
  if (!isRecord(raw)) fail(path, "expected an object");
  return {
    code: str(raw, "code", path),
    name: str(raw, "name", path),
    definition: str(raw, "definition", path),
    example: str(raw, "example", path),
    probe: str(raw, "probe", path),
    tier: int(raw, "tier", path, 1),
    tierLabel: str(raw, "tierLabel", path),
    isL1Transfer: bool(raw, "isL1Transfer", path),
  };
}

function parseLevel(raw: unknown, path: string): Level {
  if (!isRecord(raw)) fail(path, "expected an object");
  const foilDesignLogic = raw.foilDesignLogic;
  const researchRationale = raw.researchRationale;
  if (typeof foilDesignLogic !== "string") fail(`${path}.foilDesignLogic`, "expected a string");
  if (typeof researchRationale !== "string") fail(`${path}.researchRationale`, "expected a string");
  return {
    level: int(raw, "level", path, 1),
    skillId: str(raw, "skillId", path),
    skillPattern: str(raw, "skillPattern", path),
    targetWordCount: int(raw, "targetWordCount", path, 1),
    foilDesignLogic,
    researchRationale,
  };
}

function parseItem(raw: unknown, path: string): Item {
  if (!isRecord(raw)) fail(path, "expected an object");
  const id = str(raw, "id", path);
  if (!ITEM_ID.test(id)) fail(`${path}.id`, "expected item-NNN");
  if (!Array.isArray(raw.foils) || raw.foils.length !== 3) fail(`${path}.foils`, "expected exactly 3 foils");
  const designNote = raw.designNote;
  if (designNote !== null && typeof designNote !== "string") fail(`${path}.designNote`, "expected a string or null");
  return {
    id,
    sourceRow: int(raw, "sourceRow", path, 2),
    level: int(raw, "level", path, 1),
    itemNumber: int(raw, "itemNumber", path, 1),
    sequenceInLevel: int(raw, "sequenceInLevel", path, 1),
    skillId: str(raw, "skillId", path),
    skillPattern: str(raw, "skillPattern", path),
    target: word(raw, "target", path),
    foils: raw.foils.map((f, i) => parseFoil(f, `${path}.foils[${i}]`)),
    realWordFoilCount: int(raw, "realWordFoilCount", path, 0, 3),
    l1TransferFoilCount: int(raw, "l1TransferFoilCount", path, 0, 3),
    designNote,
  };
}

export function parseCurriculum(raw: unknown): Curriculum {
  if (!isRecord(raw)) fail("", "expected an object");
  if (raw.schemaVersion !== CURRICULUM_SCHEMA_VERSION) fail("schemaVersion", `expected ${CURRICULUM_SCHEMA_VERSION}`);
  const contentVersion = str(raw, "contentVersion", "");
  if (!SHA256.test(contentVersion)) fail("contentVersion", "expected a sha256 hex string");
  if (!isRecord(raw.source)) fail("source", "expected an object");
  const source = { file: str(raw.source, "file", "source"), sha256: str(raw.source, "sha256", "source") };
  if (!SHA256.test(source.sha256)) fail("source.sha256", "expected a sha256 hex string");
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) fail("levels", "expected a non-empty array");
  if (!Array.isArray(raw.foilCodebook) || raw.foilCodebook.length === 0) fail("foilCodebook", "expected a non-empty array");
  if (!Array.isArray(raw.items) || raw.items.length === 0) fail("items", "expected a non-empty array");
  if (!Array.isArray(raw.researchNotes) || raw.researchNotes.some((n) => typeof n !== "string")) {
    fail("researchNotes", "expected string[]");
  }

  const curriculum: Curriculum = {
    schemaVersion: CURRICULUM_SCHEMA_VERSION,
    contentVersion,
    source,
    levels: raw.levels.map((l, i) => parseLevel(l, `levels[${i}]`)),
    foilCodebook: raw.foilCodebook.map((c, i) => parseCodebookEntry(c, `foilCodebook[${i}]`)),
    items: raw.items.map((it, i) => parseItem(it, `items[${i}]`)),
    researchNotes: raw.researchNotes as string[],
  };

  const codes = new Set(curriculum.foilCodebook.map((e) => e.code));
  for (const item of curriculum.items) {
    for (const foil of item.foils) {
      if (!codes.has(foil.code)) {
        throw new CurriculumError(`Foil code "${foil.code}" on ${item.id} is not in the codebook`);
      }
    }
    const words = new Set([item.target, ...item.foils.map((f) => f.word)]);
    if (words.size !== 4) throw new CurriculumError(`${item.id} has duplicate choices`);
  }
  const ids = new Set(curriculum.items.map((i) => i.id));
  if (ids.size !== curriculum.items.length) throw new CurriculumError("duplicate item ids");
  return curriculum;
}

export const itemsForLevel = (curriculum: Curriculum, level: number): Item[] =>
  curriculum.items
    .filter((item) => item.level === level)
    .sort((a, b) => a.sequenceInLevel - b.sequenceInLevel);

export const codebookEntry = (
  curriculum: Curriculum,
  code: string,
): FoilCodebookEntry | undefined => curriculum.foilCodebook.find((e) => e.code === code);

/** Codebook tier for a foil code; unknown codes sort last. */
export function tierLookup(curriculum: Curriculum): (code: string) => number {
  const tiers = new Map(curriculum.foilCodebook.map((e) => [e.code, e.tier]));
  return (code) => tiers.get(code) ?? Number.POSITIVE_INFINITY;
}
