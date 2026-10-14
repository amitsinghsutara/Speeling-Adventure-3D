import { describe, expect, it } from "vitest";
import { findInteractableInRange, type WorldInteractable } from "@/game/quest/interactables";
import { INITIAL_QUEST_STATE, createQuestController, questReducer } from "@/game/quest/questController";
import { EMPTY_REWARDS, grantReward, starRewardId } from "@/game/quest/rewards";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { createCurriculumLearningService, type LearningService } from "@/learning/service";

const SIGN: WorldInteractable = {
  id: "sign-1",
  kind: "spelling-sign",
  promptKey: "prompt.sign.read",
  position: [3, 0, 12],
  interactionRadius: 2.5,
  questId: "level-1/puzzle-1",
};

const SIGN_2: WorldInteractable = { ...SIGN, id: "sign-2", questId: "level-1/puzzle-2" };

const LANDMARK: WorldInteractable = {
  id: "rock",
  kind: "landmark",
  promptKey: "prompt.rock",
  position: [3, 0, 14],
  interactionRadius: 2.5,
};

function makeService(): LearningService {
  let n = 0;
  return createCurriculumLearningService(loadCurriculum(), {
    now: () => 1,
    random: () => 0.3,
    newId: () => `id-${++n}`,
  });
}

/** Plays the active quest to completion, making `mistakes` wrong picks along the way. */
function finishQuest(quest: ReturnType<typeof createQuestController>, mistakes = 0) {
  let guard = 0;
  while (quest.getState().phase === "active" && guard++ < 80) {
    const state = quest.getState();
    if (state.celebrating) {
      quest.advance();
      continue;
    }
    const challenge = state.challenge!;
    const disabled = state.lastResult?.disabledWords ?? [];
    const foil = challenge.choices.find((c) => c.word !== challenge.targetWord && !disabled.includes(c.word));
    if (state.mistakes < mistakes && foil) {
      quest.submitAnswer(foil.word);
      continue;
    }
    quest.submitAnswer(challenge.targetWord);
  }
}

describe("findInteractableInRange", () => {
  it("returns the nearest interactable whose radius contains the position", () => {
    expect(findInteractableInRange([3, 0, 12.4], [SIGN, LANDMARK])?.id).toBe("sign-1");
    expect(findInteractableInRange([3, 0, 13.6], [SIGN, LANDMARK])?.id).toBe("rock");
    expect(findInteractableInRange([20, 0, 20], [SIGN, LANDMARK])).toBeNull();
  });
});

describe("rewards", () => {
  it("grants each star id once", () => {
    const id = starRewardId("level-1/puzzle-1", 1);
    const first = grantReward(EMPTY_REWARDS, id);
    expect(first.granted).toBe(true);
    expect(first.rewards.stars).toBe(1);
    const second = grantReward(first.rewards, id);
    expect(second.granted).toBe(false);
    expect(second.rewards).toBe(first.rewards);
  });
});

describe("questReducer", () => {
  it("moves between idle and available with proximity", () => {
    const available = questReducer(INITIAL_QUEST_STATE, { type: "proximity", interactable: SIGN });
    expect(available.phase).toBe("available");
    expect(questReducer(available, { type: "proximity", interactable: null }).phase).toBe("idle");
  });

  it("ignores answers outside the active phase", () => {
    const state = questReducer(INITIAL_QUEST_STATE, {
      type: "answered",
      result: {
        correct: true,
        feedbackKey: "correct",
        nextAction: "complete",
        hint: null,
        disabledWords: [],
        progress: { newWordsDone: 5, newWordsTotal: 5, questionsAsked: 5, mistakes: 0 },
        nextChallenge: null,
        completion: { stars: 3, mistakes: 0 },
      },
    });
    expect(state).toBe(INITIAL_QUEST_STATE);
  });
});

describe("createQuestController", () => {
  it("plays a whole puzzle: wrong tile disabled, celebrate, advance, complete with stars", () => {
    const quest = createQuestController(makeService());
    expect(quest.interact()).toBe(false);
    quest.setProximity(SIGN);
    expect(quest.interact()).toBe(true);
    let state = quest.getState();
    expect(state.phase).toBe("active");
    expect(state.challenge?.targetWord).toBe("sat");

    quest.submitAnswer("sit");
    state = quest.getState();
    expect(state.mistakes).toBe(1);
    expect(state.lastResult?.disabledWords).toEqual(["sit"]);
    expect(state.lastResult?.hint).toMatch(/middle/);

    expect(quest.submitAnswer("sat")?.correct).toBe(true);
    state = quest.getState();
    expect(state.celebrating).toBe(true);
    expect(state.challenge?.targetWord).toBe("sat");
    expect(quest.submitAnswer("anything")).toBeNull();
    quest.advance();
    state = quest.getState();
    expect(state.celebrating).toBe(false);
    expect(state.challenge?.newWordsDone).toBe(1);
    expect(state.lastResult).toBeNull();

    finishQuest(quest);
    state = quest.getState();
    expect(state.phase).toBe("completed");
    expect(state.starsEarned).toBe(2);
    expect(state.newStars).toBe(2);
    expect(state.rewards.stars).toBe(2);
    expect(state.rewards.collectedRewardIds).toEqual([
      "star:level-1/puzzle-1#1",
      "star:level-1/puzzle-1#2",
    ]);
    expect(state.completedQuestIds).toEqual(["level-1/puzzle-1"]);

    quest.dismiss();
    expect(quest.getState().phase).toBe("available");
  });

  it("a better replay adds the missing star; a worse one never removes any", () => {
    const quest = createQuestController(makeService());
    quest.setProximity(SIGN);
    quest.interact();
    finishQuest(quest, 1);
    expect(quest.getState().starsEarned).toBe(2);
    quest.dismiss();

    quest.interact();
    finishQuest(quest, 0);
    expect(quest.getState()).toMatchObject({ starsEarned: 3, newStars: 1 });
    expect(quest.getState().rewards.stars).toBe(3);
    quest.dismiss();

    quest.interact();
    finishQuest(quest, 4);
    expect(quest.getState()).toMatchObject({ starsEarned: 1, newStars: 0 });
    expect(quest.getState().rewards.stars).toBe(3);
  });

  it("locks the second puzzle until the first is complete", () => {
    const quest = createQuestController(makeService());
    quest.setProximity(SIGN_2);
    quest.interact();
    expect(quest.getState()).toMatchObject({ phase: "error", errorCode: "locked" });
    quest.cancel();
    expect(quest.getState().phase).toBe("available");

    quest.setProximity(SIGN);
    quest.interact();
    finishQuest(quest);
    quest.dismiss();
    quest.setProximity(SIGN_2);
    quest.interact();
    expect(quest.getState().phase).toBe("active");
    expect(quest.getState().challenge?.questId).toBe("level-1/puzzle-2");
  });

  it("cancel discards the round without recording an event", () => {
    const service = makeService();
    const quest = createQuestController(service);
    quest.setProximity(SIGN);
    quest.interact();
    quest.submitAnswer("sit");
    quest.cancel();
    expect(quest.getState().phase).toBe("available");
    expect(service.getEvents()).toHaveLength(1);
  });

  it("ignores interactables without a quest and repeated proximity", () => {
    const quest = createQuestController(makeService());
    let notifications = 0;
    quest.subscribe(() => notifications++);
    quest.setProximity(LANDMARK);
    quest.setProximity(LANDMARK);
    expect(notifications).toBe(1);
    expect(quest.interact()).toBe(false);
  });

  it("keeps rewards out of the learning service", () => {
    const service = makeService();
    const quest = createQuestController(service);
    quest.setProximity(SIGN);
    quest.interact();
    finishQuest(quest);
    const serialized = JSON.stringify(service.getEvents());
    expect(serialized).not.toContain("star:");
    expect(serialized).not.toContain("reward");
    expect(service.getMasteryStatus().available).toBe(false);
  });
});
