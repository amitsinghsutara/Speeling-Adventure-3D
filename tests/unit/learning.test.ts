import { describe, expect, it } from "vitest";
import { CurriculumError, parseCurriculum, tierLookup } from "@/learning/curriculum";
import { createLearningEvent, parseLearningEvent } from "@/learning/events";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { buildPuzzles, chunk, levelStatuses, puzzleId, puzzleStatuses, starsForMistakes, bestStars } from "@/learning/puzzles";
import { answer, buildQuestion, hintFor, startQuestion } from "@/learning/question";
import { createCurriculumLearningService } from "@/learning/service";

const curriculum = loadCurriculum();

describe("imported curriculum", () => {
  it("matches the provenance record", () => {
    expect(curriculum.contentVersion).toBe(
      "68b831aa0a923e6931cd4420b9c126553ee9d801bd4fe6af61178666266363cf",
    );
    expect(curriculum.source.file).toBe("English_Spelling_Words_and_Foils.xlsx");
    expect(curriculum.levels).toHaveLength(10);
    expect(curriculum.foilCodebook).toHaveLength(18);
    expect(curriculum.items).toHaveLength(200);
    expect(curriculum.items[0]).toMatchObject({ id: "item-001", target: "sat", level: 1 });
  });

  it("every item has exactly 3 approved foils with known codes and no duplicate choices", () => {
    const codes = new Set(curriculum.foilCodebook.map((c) => c.code));
    for (const item of curriculum.items) {
      expect(item.foils).toHaveLength(3);
      for (const foil of item.foils) expect(codes.has(foil.code)).toBe(true);
      expect(new Set([item.target, ...item.foils.map((f) => f.word)]).size).toBe(4);
    }
  });

  it("rejects malformed datasets with a path", () => {
    expect(() => parseCurriculum(null)).toThrow(CurriculumError);
    expect(() => parseCurriculum({ ...curriculum, schemaVersion: 2 })).toThrow(/schemaVersion/);
    const bad = structuredClone(curriculum) as unknown as { items: { foils: { code: string }[] }[] };
    bad.items[0]!.foils[0]!.code = "NOPE";
    expect(() => parseCurriculum(bad)).toThrow(/not in the codebook/);
  });

  it("looks up tiers from the codebook only", () => {
    const tierOf = tierLookup(curriculum);
    expect(tierOf("IC")).toBe(1);
    expect(tierOf("PH")).toBe(4);
    expect(tierOf("??")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("puzzles", () => {
  it("splits every level into puzzles covering every item once, in sequence", () => {
    const puzzles = buildPuzzles(curriculum);
    const allIds = [...puzzles.values()].flat().flatMap((p) => p.itemIds);
    expect(new Set(allIds).size).toBe(200);
    expect(allIds).toHaveLength(200);
    expect(puzzles.get(1)?.map((p) => p.itemIds.length)).toEqual([5, 5, 5, 5, 5]);
    expect(puzzles.get(9)?.map((p) => p.itemIds.length)).toEqual([2, 2, 2, 2, 2]);
    expect(puzzles.get(1)?.[0]?.itemIds.slice(0, 2)).toEqual(["item-001", "item-002"]);
    expect(chunk([1, 2, 3], 5)).toEqual([[1], [2], [3]]);
  });

  it("unlocks levels and puzzles one after another", () => {
    const puzzles = buildPuzzles(curriculum);
    const level1 = (puzzles.get(1) ?? []).map((p) => p.id);
    expect(levelStatuses(puzzles, new Set()).get(1)).toBe("available");
    expect(levelStatuses(puzzles, new Set()).get(2)).toBe("locked");
    expect(levelStatuses(puzzles, new Set(level1)).get(2)).toBe("available");
    const statuses = puzzleStatuses(puzzles.get(1)!, new Set([puzzleId(1, 1)]), "available");
    expect(statuses.get(puzzleId(1, 1))).toBe("completed");
    expect(statuses.get(puzzleId(1, 2))).toBe("available");
    expect(statuses.get(puzzleId(1, 3))).toBe("locked");
  });

  it("awards stars by mistakes and never lowers a stored result", () => {
    expect([0, 1, 3, 4, 9].map(starsForMistakes)).toEqual([3, 2, 2, 1, 1]);
    expect(bestStars(2, 1)).toBe(2);
    expect(bestStars(undefined, 1)).toBe(1);
  });
});

describe("questions", () => {
  const item = curriculum.items[0]!;

  it("builds choices only from the item's own foils and shuffles deterministically", () => {
    const q = buildQuestion(item, { random: () => 0.5 });
    expect(q.choices.map((c) => c.word).sort()).toEqual(["hat", "sap", "sat", "sit"]);
    expect(q.choices.filter((c) => c.isTarget)).toHaveLength(1);
    expect(buildQuestion(item, { random: () => 0.5 })).toEqual(q);
    expect(() => buildQuestion(item, { random: () => 0, foils: [{ word: "zzz", code: "V" }] })).toThrow(
      /not an approved foil/,
    );
  });

  it("disables wrong choices, ignores repeats, and ends on the target", () => {
    const q = buildQuestion(item, { random: () => 0.1 });
    let state = startQuestion(q, 1000);
    let step = answer(state, "sit", 1500);
    expect(step.outcome).toMatchObject({ kind: "incorrect", attempt: { foilCode: "V", attemptNumber: 1, elapsedMs: 500 } });
    state = step.state;
    expect(answer(state, "sit", 1600).outcome).toEqual({ kind: "ignored", reason: "already-tried" });
    expect(answer(state, "cat", 1600).outcome).toEqual({ kind: "ignored", reason: "not-a-choice" });
    step = answer(state, "sat", 2000);
    expect(step.outcome.kind).toBe("correct");
    expect(step.state.status).toBe("correct");
    expect(answer(step.state, "hat", 2100).outcome).toEqual({ kind: "ignored", reason: "already-correct" });
  });

  it("maps foil codes to child-facing hints with a default", () => {
    expect(hintFor("V")).toMatch(/middle sound/);
    expect(hintFor("L1-TH")).toMatch(/th/);
    expect(hintFor("??")).toBe("Listen again and try once more.");
    expect(hintFor(undefined)).toBe("Listen again and try once more.");
  });
});

describe("learning events", () => {
  it("creates and re-parses events in the source project's schema", () => {
    const event = createLearningEvent(
      {
        sessionId: "s",
        questionId: "q",
        at: 1.4,
        contentVersion: curriculum.contentVersion,
        itemId: "item-001",
        skillId: "level-1",
        level: 1,
        puzzleId: "level-1/puzzle-1",
        presentedFoilCodes: ["V", "FC", "IC"],
        chosenWord: "sit",
        correct: false,
        chosenFoilCode: "V",
        attemptNumber: 1,
        elapsedMs: 10.6,
      },
      "id-1",
    );
    expect(event).toMatchObject({ schemaVersion: 1, learnerId: "local-learner", at: 1, elapsedMs: 11, decisionId: null });
    expect(parseLearningEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
    expect(parseLearningEvent({ ...event, chosenFoilCode: 5 })).toBeNull();
    expect(parseLearningEvent({ type: "challenge-started", schemaVersion: 1 })).toBeNull();
  });

  it("clears the foil code on a correct choice", () => {
    const event = createLearningEvent(
      {
        sessionId: "s", questionId: "q", at: 1, contentVersion: "c", itemId: "i", skillId: "k", level: 1,
        puzzleId: "p", presentedFoilCodes: [], chosenWord: "sat", correct: true, chosenFoilCode: "V",
        attemptNumber: 2, elapsedMs: 0,
      },
      "id",
    );
    expect(event.chosenFoilCode).toBeNull();
  });
});

describe("createCurriculumLearningService", () => {
  const make = (history: readonly import("@/learning/events").LearningEvent[] = []) => {
    let t = 0;
    let n = 0;
    return createCurriculumLearningService(curriculum, {
      now: () => (t += 100),
      random: () => 0.3,
      newId: () => `id-${++n}`,
      history,
    });
  };

  it("serves a puzzle's words in curriculum order, consolidates a missed word, and completes with stars", () => {
    const service = make();
    const first = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: [] });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.challenge).toMatchObject({
      itemId: "item-001",
      targetWord: "sat",
      newWordsDone: 0,
      newWordsTotal: 5,
      strategy: "CONTINUE_SEQUENCE",
      presentation: "FULL_SET",
      isExtra: false,
      provisional: true,
    });
    expect(first.challenge.choices.map((c) => c.word).sort()).toEqual(["hat", "sap", "sat", "sit"]);

    const wrong = service.submitAnswer(first.challenge.id, "sit");
    expect(wrong).toMatchObject({ correct: false, nextAction: "retry", disabledWords: ["sit"] });
    expect(wrong.hint).toMatch(/middle sound/);
    expect(wrong.progress).toMatchObject({ newWordsDone: 0, newWordsTotal: 5, mistakes: 1 });

    let challenge = first.challenge;
    let result = service.submitAnswer(challenge.id, "sat");
    expect(result).toMatchObject({ correct: true, nextAction: "next" });
    expect(result.progress).toMatchObject({ newWordsDone: 1, mistakes: 1 });
    const strategies = [challenge.strategy];
    let guard = 0;
    while (result.nextAction === "next" && guard++ < 20) {
      challenge = result.nextChallenge!;
      strategies.push(challenge.strategy);
      result = service.submitAnswer(challenge.id, challenge.targetWord);
    }
    // Five new words, then the missed word is consolidated as a free extra.
    expect(strategies).toEqual([
      "CONTINUE_SEQUENCE",
      "CONTINUE_SEQUENCE",
      "CONTINUE_SEQUENCE",
      "CONTINUE_SEQUENCE",
      "CONTINUE_SEQUENCE",
      "CONSOLIDATE",
    ]);
    expect(result.nextAction).toBe("complete");
    expect(result.completion).toEqual({ stars: 2, mistakes: 1 });

    const events = service.getEvents();
    expect(events).toHaveLength(7);
    expect(events[0]).toMatchObject({
      itemId: "item-001",
      puzzleId: "level-1/puzzle-1",
      chosenWord: "sit",
      correct: false,
      chosenFoilCode: "V",
      attemptNumber: 1,
      presentedFoilCodes: ["V", "FC", "IC"],
      contentVersion: curriculum.contentVersion,
      decisionId: first.challenge.id,
    });
    const decisions = service.getDecisions();
    expect(decisions).toHaveLength(6);
    expect(decisions[5]).toMatchObject({ strategy: "CONSOLIDATE", itemId: "item-001", countsForStars: false, provisional: true });
  });

  it("does not charge mistakes on extra questions", () => {
    const service = make();
    let sel = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: [] });
    if (!sel.ok) throw new Error("expected ok");
    let challenge = sel.challenge;
    service.submitAnswer(challenge.id, "sit"); // one real mistake
    let result = service.submitAnswer(challenge.id, "sat");
    let guard = 0;
    while (result.nextAction === "next" && guard++ < 20) {
      challenge = result.nextChallenge!;
      if (challenge.isExtra) {
        const foil = challenge.choices.find((c) => c.word !== challenge.targetWord)!;
        expect(service.submitAnswer(challenge.id, foil.word).progress.mistakes).toBe(1);
      }
      result = service.submitAnswer(challenge.id, challenge.targetWord);
    }
    expect(result.completion).toEqual({ stars: 2, mistakes: 1 });
    sel = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: ["level-1/puzzle-1"] });
    expect(sel.ok).toBe(true);
  });

  it("uses restored history for the learner model and never re-records it", () => {
    const history = ["item-002", "item-003", "item-004"].map((id, i) => {
      const item = curriculum.items.find((x) => x.id === id)!;
      return {
        schemaVersion: 1 as const,
        id: `h-${i}`,
        learnerId: "local-learner",
        sessionId: "old",
        questionId: `hq-${i}`,
        at: 10 + i,
        contentVersion: curriculum.contentVersion,
        itemId: id,
        skillId: item.skillId,
        level: 1,
        puzzleId: "level-1/puzzle-1",
        presentedFoilCodes: item.foils.map((f) => f.code),
        chosenWord: item.foils.find((f) => f.code === "V")?.word ?? "x",
        correct: false,
        chosenFoilCode: "V",
        attemptNumber: 1,
        elapsedMs: 5,
        decisionId: null,
      };
    });
    const seen: string[] = [];
    let n = 0;
    const service = createCurriculumLearningService(curriculum, {
      now: () => 1000,
      random: () => 0.3,
      newId: () => `n-${++n}`,
      history,
      sink: (e) => seen.push(e.id),
    });
    expect(service.getEvents()).toHaveLength(3);
    expect(seen).toEqual([]);
    const sel = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: [] });
    if (!sel.ok) throw new Error("expected ok");
    // A repeated vowel pattern across three words triggers focused practice first.
    expect(sel.challenge).toMatchObject({ strategy: "FOCUS_ERROR_PATTERN", isExtra: true });
    expect(service.getProgressReport().trickySpots.map((s) => s.code)).toEqual(["V"]);
  });

  it("refuses locked and unknown puzzles", () => {
    const service = make();
    expect(service.selectChallenge({ questId: "level-1/puzzle-2", completedQuestIds: [] })).toMatchObject({ ok: false, code: "locked" });
    expect(service.selectChallenge({ questId: "level-1/puzzle-2", completedQuestIds: ["level-1/puzzle-1"] }).ok).toBe(true);
    expect(service.selectChallenge({ questId: "level-2/puzzle-1", completedQuestIds: ["level-1/puzzle-1"] })).toMatchObject({ ok: false, code: "locked" });
    expect(service.selectChallenge({ questId: "nope", completedQuestIds: [] })).toMatchObject({ ok: false, code: "unknown-quest" });
  });

  it("ignores stale, repeated and non-choice answers without recording events", () => {
    const service = make();
    const sel = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: [] });
    if (!sel.ok) throw new Error("expected ok");
    expect(service.submitAnswer("missing", "sat").feedbackKey).toBe("ignored");
    expect(service.submitAnswer(sel.challenge.id, "zebra").feedbackKey).toBe("ignored");
    service.submitAnswer(sel.challenge.id, "sit");
    expect(service.submitAnswer(sel.challenge.id, "sit").feedbackKey).toBe("ignored");
    expect(service.getEvents()).toHaveLength(1);
  });

  it("discards the round on cancel, never claims mastery, and reports quest info", () => {
    const service = make();
    const sel = service.selectChallenge({ questId: "level-1/puzzle-1", completedQuestIds: [] });
    if (!sel.ok) throw new Error("expected ok");
    service.cancelChallenge(sel.challenge.id);
    expect(service.submitAnswer(sel.challenge.id, "sat").feedbackKey).toBe("ignored");
    expect(service.getQuestInfo("level-1/puzzle-3", ["level-1/puzzle-1"])).toEqual({
      questId: "level-1/puzzle-3",
      level: 1,
      number: 3,
      itemCount: 5,
      status: "locked",
    });
    expect(service.getMasteryStatus().available).toBe(false);
    expect(service.getContentInfo()).toMatchObject({ items: 200, levels: 10, provisional: true });
    expect(service.getProgressReport().provisional).toBe(true);
  });
});
