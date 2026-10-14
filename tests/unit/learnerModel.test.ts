import { describe, expect, it } from "vitest";
import { createLearningEvent } from "@/learning/events";
import {
  DEFAULT_LEARNER_MODEL_CONFIG,
  validateLearnerModelConfig,
  type LearnerModelConfig,
} from "@/learning/learnerConfig";
import { buildLearnerModel, groupQuestions } from "@/learning/learnerModel";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { DEFAULT_POLICY_CONFIG } from "@/learning/policyConfig";
import { STATUS_TEXT, buildProgressReport, levelStatus, percent } from "@/learning/report";
import { answerEvents, correctAnswers } from "../fixtures/events";

const curriculum = loadCurriculum();
const config = DEFAULT_LEARNER_MODEL_CONFIG;
const model = (events: Parameters<typeof buildLearnerModel>[0], cfg: LearnerModelConfig = config) =>
  buildLearnerModel(events, curriculum, cfg);

/** Level-1 item ids in order: item-001 … item-025. */
const items = curriculum.items.filter((i) => i.level === 1).map((i) => i.id);
const item = (n: number): string => items[n] ?? "missing";

describe("learning events", () => {
  it("records no foil code when the target was chosen", () => {
    const [event] = answerEvents({ itemId: item(0), picks: ["target"] });
    expect(event).toMatchObject({ correct: true, chosenFoilCode: null, attemptNumber: 1, decisionId: null });
  });

  it("rejects a malformed event at creation", () => {
    expect(() =>
      createLearningEvent({
        sessionId: "",
        questionId: "q",
        at: 1,
        contentVersion: "x",
        itemId: "item-001",
        skillId: "level-1",
        level: 1,
        puzzleId: "p",
        presentedFoilCodes: [],
        chosenWord: "sat",
        correct: true,
        attemptNumber: 1,
        elapsedMs: 5,
      }),
    ).toThrow(/invalid event/);
  });
});

describe("learner model config", () => {
  it("is marked provisional until confirmed", () => {
    expect(config.provisional).toBe(true);
  });

  it.each([
    ["a single mistake", { minErrors: 1 }],
    ["a single word", { minDistinctItems: 1 }],
    ["more errors than the window holds", { windowQuestions: 2, minErrors: 3 }],
  ])("refuses settings that would allow a pattern from %s", (_, override) => {
    const candidate = { ...config, errorPattern: { ...config.errorPattern, ...override } };
    expect(validateLearnerModelConfig(candidate).length).toBeGreaterThan(0);
  });
});

describe("question grouping", () => {
  it("groups retries into one question and knows the first try", () => {
    const [q] = groupQuestions(answerEvents({ itemId: item(0), picks: ["V", "FC", "target"] }));
    expect(q).toMatchObject({ itemId: item(0), firstTryCorrect: false, solved: true });
    expect(q?.attempts).toHaveLength(3);
  });
});

describe("skill statistics", () => {
  it("counts first-try accuracy per skill", () => {
    const events = [
      ...correctAnswers([item(0), item(1), item(2)]),
      ...answerEvents({ itemId: item(3), picks: ["V", "target"] }),
    ];
    expect(model(events).bySkill.get("level-1")).toMatchObject({
      questions: 4,
      firstTryCorrect: 3,
      firstTryAccuracy: 0.75,
      distinctItems: 4,
    });
  });

  it("says when there is not yet enough evidence, instead of implying mastery", () => {
    const few = model(correctAnswers([item(0), item(1)])).bySkill.get("level-1");
    expect(few).toMatchObject({ firstTryAccuracy: 1, evidence: "insufficient" });
    const enough = model(correctAnswers(items.slice(0, config.minQuestionsForEvidence))).bySkill.get("level-1");
    expect(enough?.evidence).toBe("enough");
  });

  it("tracks recent accuracy separately from all-time accuracy", () => {
    const events = [
      ...items.slice(0, 10).flatMap((id) => answerEvents({ itemId: id, picks: ["V", "target"] })),
      ...correctAnswers(items.slice(10, 20)),
    ];
    const stats = model(events).bySkill.get("level-1");
    expect(stats?.firstTryAccuracy).toBe(0.5);
    expect(stats?.recentFirstTryAccuracy).toBe(1);
  });
});

describe("foil type and item statistics", () => {
  it("counts how often each foil type was shown and chosen", () => {
    const events = [
      ...answerEvents({ itemId: item(0), picks: ["V", "target"] }),
      ...answerEvents({ itemId: item(1), picks: ["target"] }),
    ];
    expect(model(events).byFoilType.get("V")).toMatchObject({ tier: 2, presentedIn: 2, chosen: 1, errorRate: 0.5 });
    expect(model(events).byFoilType.get("IC")).toMatchObject({ presentedIn: 2, chosen: 0, errorRate: 0 });
  });

  it("ignores retry choices when only first choices count", () => {
    const events = answerEvents({ itemId: item(0), picks: ["V", "FC", "target"] });
    expect(model(events).byFoilType.get("FC")?.chosen).toBe(0);
    expect(model(events, { ...config, firstChoiceOnly: false }).byFoilType.get("FC")?.chosen).toBe(1);
  });

  it("remembers when each item was last seen and how it went", () => {
    const events = [...answerEvents({ itemId: item(0), picks: ["V", "target"] }), ...correctAnswers([item(0)])];
    expect(model(events).byItem.get(item(0))).toMatchObject({ timesSeen: 2, firstTryCorrect: 1, lastFirstTryCorrect: true });
  });

  it("ignores events for items no longer in the curriculum", () => {
    const events = [...correctAnswers(["item-999"]), ...correctAnswers([item(0)])];
    const m = model(events);
    expect(m.ignoredEvents).toBe(1);
    expect(m.questions).toHaveLength(1);
  });
});

describe("error pattern detection", () => {
  const vowelMistake = (n: number) => answerEvents({ itemId: item(n), picks: ["V", "target"] });

  it("never reports a pattern from a single mistake", () => {
    expect(model(vowelMistake(0)).errorPatterns).toEqual([]);
  });

  it("does not report a pattern from repeated mistakes on one word", () => {
    const events = [0, 0, 0, 0].flatMap((n) => vowelMistake(n));
    expect(model(events).errorPatterns).toEqual([]);
  });

  it("reports a pattern from repeated mistakes across different words, citing its evidence", () => {
    const events = [...vowelMistake(0), ...correctAnswers([item(1)]), ...vowelMistake(2), ...vowelMistake(3)];
    const [pattern, ...rest] = model(events).errorPatterns;
    expect(rest).toEqual([]);
    expect(pattern).toMatchObject({ foilCode: "V", errors: 3, distinctItems: 3, questionsInWindow: 4, errorRate: 0.75 });
    const vowelErrorIds = events.filter((e) => e.chosenFoilCode === "V").map((e) => e.id);
    expect(pattern?.evidenceEventIds).toEqual(vowelErrorIds);
  });

  it("needs the error rate to stay high, not just a count", () => {
    const events = [
      ...vowelMistake(0),
      ...correctAnswers(items.slice(1, 6)),
      ...vowelMistake(6),
      ...correctAnswers(items.slice(7, 9)),
      ...vowelMistake(9),
    ];
    // 3 errors, but only 3 of the last 10 questions showing V (rate 0.3 = threshold).
    expect(model(events).errorPatterns.map((p) => p.foilCode)).toEqual(["V"]);
    const stricter = { ...config, errorPattern: { ...config.errorPattern, minErrorRate: 0.31 } };
    expect(model(events, stricter).errorPatterns).toEqual([]);
  });

  it("lets an old pattern fade once recent answers are right", () => {
    const events = [...vowelMistake(0), ...vowelMistake(1), ...vowelMistake(2), ...correctAnswers(items.slice(3, 13))];
    expect(model(events).errorPatterns).toEqual([]);
  });

  it("only looks at questions where that foil type was actually on screen", () => {
    const noVowelFoil = ["FC", "IC"];
    const events = [
      ...vowelMistake(0),
      ...correctAnswers(items.slice(1, 12), noVowelFoil),
      ...vowelMistake(12),
      ...vowelMistake(13),
    ];
    expect(model(events).errorPatterns.map((p) => p.foilCode)).toEqual(["V"]);
  });

  it("is deterministic: the same events always give the same model", () => {
    const events = [...vowelMistake(0), ...vowelMistake(2), ...vowelMistake(3)];
    expect(model(events)).toEqual(model([...events].reverse()));
  });
});

describe("grown-ups progress report", () => {
  const report = (events: Parameters<typeof buildLearnerModel>[0]) =>
    buildProgressReport(model(events), curriculum, DEFAULT_POLICY_CONFIG);

  it("is empty and honest for a new child", () => {
    const r = report([]);
    expect(r).toMatchObject({ questions: 0, wordsPractised: 0, firstTryAccuracy: null, trickySpots: [], practiseWords: [], provisional: true });
    expect(r.levels.every((l) => l.status === "not-started")).toBe(true);
    expect(r.levels).toHaveLength(10);
  });

  it('says "just getting started" until there is enough evidence, even when every answer was right', () => {
    const r = report(correctAnswers(items.slice(0, 3)));
    expect(r.levels[0]).toMatchObject({ questions: 3, firstTryAccuracy: 1, status: "just-started" });
  });

  it('says "doing well recently" only with enough evidence and high recent accuracy, otherwise "still practising"', () => {
    expect(report(correctAnswers(items.slice(0, 10))).levels[0]?.status).toBe("doing-well");
    const mixed = items.slice(0, 10).flatMap((id, i) => answerEvents({ itemId: id, picks: i % 2 ? ["target"] : ["V", "target"] }));
    expect(report(mixed).levels[0]?.status).toBe("practising");
  });

  it('never uses the word "mastered" in any status', () => {
    expect(Object.values(STATUS_TEXT).join(" ").toLowerCase()).not.toMatch(/master/);
  });

  it("describes tricky spots with the codebook's own name and example", () => {
    const events = ["item-002", "item-003", "item-004"].flatMap((itemId) => answerEvents({ itemId, picks: ["V", "target"] }));
    expect(report(events).trickySpots).toEqual([{ code: "V", name: "Vowel substitution", example: "cat > cot", chosen: 3, presentedIn: 3 }]);
  });

  it("lists words to practise: wrong first time on their latest try, most recent first", () => {
    const events = [
      ...answerEvents({ itemId: "item-001", picks: ["V", "target"] }),
      ...answerEvents({ itemId: "item-002", picks: ["V", "target"] }),
      ...answerEvents({ itemId: "item-002", picks: ["target"] }), // now right: drops off the list
      ...answerEvents({ itemId: "item-003", picks: ["FC", "target"] }),
    ];
    expect(report(events).practiseWords).toEqual(["cat", "sat"]);
  });

  it("formats percentages and missing values plainly", () => {
    expect(percent(0.756)).toBe("76%");
    expect(percent(null)).toBe("n/a");
    expect(levelStatus(0, null, "none", 0.8)).toBe("not-started");
  });
});
