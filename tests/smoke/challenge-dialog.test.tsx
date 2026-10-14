import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChallengeDialog } from "@/components/ChallengeDialog";
import { INITIAL_QUEST_STATE, type QuestState } from "@/game/quest/questController";
import type { AnswerResult, SpellingChallenge } from "@/learning/service";

const CHALLENGE: SpellingChallenge = {
  id: "q1",
  questId: "level-1/puzzle-1",
  itemId: "item-001",
  skillId: "level-1",
  level: 1,
  targetWord: "sat",
  choices: [{ word: "sit" }, { word: "sat" }, { word: "sap" }, { word: "hat" }],
  newWordsDone: 0,
  newWordsTotal: 5,
  strategy: "CONTINUE_SEQUENCE",
  presentation: "FULL_SET",
  isExtra: false,
  provisional: true,
};

const ACTIVE: QuestState = {
  ...INITIAL_QUEST_STATE,
  phase: "active",
  questId: "level-1/puzzle-1",
  challenge: CHALLENGE,
};

const WRONG: AnswerResult = {
  correct: false,
  feedbackKey: "incorrect-retry",
  nextAction: "retry",
  hint: "Listen to the middle sound.",
  disabledWords: ["sit"],
  progress: { newWordsDone: 0, newWordsTotal: 5, questionsAsked: 1, mistakes: 1 },
  nextChallenge: null,
  completion: null,
};

function setup(quest: QuestState) {
  const onSubmit = vi.fn();
  const onAdvance = vi.fn();
  const onCancel = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <ChallengeDialog
      quest={quest}
      onSubmit={onSubmit}
      onAdvance={onAdvance}
      onCancel={onCancel}
      onDismiss={onDismiss}
    />,
  );
  return { ...utils, onSubmit, onAdvance, onCancel, onDismiss };
}

describe("ChallengeDialog", () => {
  it("shows four word tiles and submits the tapped word", () => {
    const { onSubmit } = setup(ACTIVE);
    expect(screen.getByRole("heading")).toHaveTextContent(/listen and pick/i);
    expect(screen.getByText(/word 1 of 5/i)).toBeInTheDocument();
    const choices = screen.getByRole("group", { name: /choices/i });
    const tiles = Array.from(choices.querySelectorAll("button"));
    expect(tiles.map((t) => t.textContent)).toEqual(["sit", "sat", "sap", "hat"]);
    fireEvent.click(tiles[1]!);
    expect(onSubmit).toHaveBeenCalledWith("sat");
  });

  it("labels policy-chosen practice words as extras", () => {
    setup({ ...ACTIVE, challenge: { ...CHALLENGE, isExtra: true, strategy: "CONSOLIDATE", newWordsDone: 5 } });
    expect(screen.getByText(/practice word · 5 of 5 done/i)).toBeInTheDocument();
  });

  it("disables a wrong tile and shows its hint", () => {
    setup({ ...ACTIVE, mistakes: 1, lastResult: WRONG });
    expect(screen.getByRole("button", { name: "sit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "sat" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(/middle sound/i);
  });

  it("celebrates a correct answer and advances", () => {
    const { onAdvance } = setup({
      ...ACTIVE,
      celebrating: true,
      lastResult: { ...WRONG, correct: true, feedbackKey: "correct", nextAction: "next", hint: null, disabledWords: [] },
    });
    expect(screen.getByText(/yes! that's sat/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "sat" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /next word/i }));
    expect(onAdvance).toHaveBeenCalled();
  });

  it("reveals the word when the recording cannot play and speech is unavailable", async () => {
    class FailingAudio {
      play() {
        return Promise.reject(new Error("no media in test"));
      }
      pause() {}
    }
    vi.stubGlobal("Audio", FailingAudio);
    try {
      setup(ACTIVE);
      fireEvent.click(screen.getByRole("button", { name: /hear it again/i }));
      const reveal = await screen.findByText(/the word is/i);
      expect(reveal).toHaveTextContent("sat");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("cancels with Escape and the close button", () => {
    const { onCancel } = setup(ACTIVE);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /close and go back/i }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("shows stars on completion and dismisses", () => {
    const { onDismiss } = setup({
      ...ACTIVE,
      phase: "completed",
      starsEarned: 2,
      newStars: 2,
      rewards: { stars: 2, collectedRewardIds: ["star:level-1/puzzle-1#1", "star:level-1/puzzle-1#2"] },
    });
    expect(screen.getByRole("heading")).toHaveTextContent(/puzzle finished/i);
    expect(screen.getByLabelText(/2 stars/i)).toBeInTheDocument();
    expect(screen.getByText(/earned 2 new stars/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^back to the meadow$/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("explains a locked sign gently, and other errors with details", () => {
    const { onCancel } = setup({ ...INITIAL_QUEST_STATE, phase: "error", errorCode: "locked", error: "locked" });
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/finish the other sign first/i);
    expect(screen.queryByText(/details for grown-ups/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to the meadow/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
