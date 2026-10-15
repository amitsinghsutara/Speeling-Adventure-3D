import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GrownUpsScreen, type GrownUpsFacts } from "@/components/GrownUpsScreen";
import { HOLD_MS, HoldButton } from "@/components/HoldButton";
import { starsByQuest } from "@/game/quest/rewards";
import { DEFAULT_LEARNER_MODEL_CONFIG } from "@/learning/learnerConfig";
import { buildLearnerModel } from "@/learning/learnerModel";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { DEFAULT_POLICY_CONFIG } from "@/learning/policyConfig";
import { buildProgressReport } from "@/learning/report";
import { answerEvents, correctAnswers } from "../fixtures/events";

describe("HoldButton (child gate)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onComplete = vi.fn<() => void>();
    render(
      <HoldButton label="For grown-ups: press and hold to open" onComplete={onComplete}>
        For grown-ups
      </HoldButton>,
    );
    return { onComplete, button: screen.getByRole("button", { name: /press and hold/ }) };
  };

  it("does nothing on a tap or click", () => {
    const { onComplete, button } = setup();
    fireEvent.click(button);
    fireEvent.pointerDown(button, { button: 0 });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(button);
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("opens after a full hold", () => {
    const { onComplete, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => vi.advanceTimersByTime(HOLD_MS - 1));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cancels if the finger slides off", () => {
    const { onComplete, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => vi.advanceTimersByTime(HOLD_MS / 2));
    fireEvent.pointerLeave(button);
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("works from the keyboard by holding Enter or Space", () => {
    const { onComplete, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(onComplete).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(button, { key: " " });
    act(() => vi.advanceTimersByTime(HOLD_MS / 2));
    fireEvent.keyUp(button, { key: " " });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe("starsByQuest", () => {
  it("counts star ids per quest and ignores other reward ids", () => {
    const stars = starsByQuest(["star:level-1/puzzle-1#1", "star:level-1/puzzle-1#2", "star:level-1/puzzle-2#1", "badge:x"]);
    expect(stars.get("level-1/puzzle-1")).toBe(2);
    expect(stars.get("level-1/puzzle-2")).toBe(1);
    expect(stars.size).toBe(2);
  });
});

describe("GrownUpsScreen", () => {
  const curriculum = loadCurriculum();
  const facts: GrownUpsFacts = {
    buildId: "test-build",
    contentVersion: curriculum.contentVersion,
    contentSource: curriculum.source.file,
    provisionalRules: true,
    persistent: true,
    offlinePhase: "ready",
    storedEvents: 0,
  };
  const reportFor = (events: Parameters<typeof buildLearnerModel>[0]) =>
    buildProgressReport(buildLearnerModel(events, curriculum, DEFAULT_LEARNER_MODEL_CONFIG), curriculum, DEFAULT_POLICY_CONFIG);

  it("is honest for a new child and never says mastered", () => {
    render(<GrownUpsScreen report={reportFor([])} stars={[]} facts={facts} onBack={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText(/no answers yet on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/no repeated mistakes spotted/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is sent anywhere/i)).toBeInTheDocument();
    expect(screen.getByText(/still provisional/i)).toBeInTheDocument();
    expect(screen.getByTestId("grownups").textContent?.toLowerCase()).not.toMatch(/mastered/);
    expect(screen.queryByText(/^levels$/i)).not.toBeInTheDocument();
  });

  it("shows levels, stars, tricky spots and words to practise", () => {
    const events = [
      ...answerEvents({ itemId: "item-002", picks: ["V", "target"] }),
      ...answerEvents({ itemId: "item-003", picks: ["V", "target"] }),
      ...answerEvents({ itemId: "item-004", picks: ["V", "target"] }),
      ...correctAnswers(["item-001"]),
    ];
    render(
      <GrownUpsScreen
        report={reportFor(events)}
        stars={[{ level: 1, earned: 2, max: 15 }]}
        facts={{ ...facts, storedEvents: 7 }}
        onBack={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByLabelText(/2 of 15 stars/i)).toBeInTheDocument();
    expect(screen.getByText(/just getting started/i)).toBeInTheDocument();
    expect(screen.getByText(/vowel substitution/i)).toBeInTheDocument();
    expect(screen.getByText(/map, cat, mat/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("offers graphics presets and reports what is running", () => {
    const onChange = vi.fn();
    render(
      <GrownUpsScreen
        report={reportFor([])}
        stars={[]}
        facts={facts}
        graphics={{ preference: "auto", effective: "medium", urlOverride: false, stats: { averageFps: 29.6, drawCalls: 42, triangles: 123456 }, onChange }}
        onBack={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("fps")).toHaveTextContent("30");
    expect(screen.getByText("42")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Low" }));
    expect(onChange).toHaveBeenCalledWith("low");
  });

  it("asks before resetting and only resets on confirmation", () => {
    const onReset = vi.fn();
    const onBack = vi.fn();
    render(<GrownUpsScreen report={reportFor([])} stars={[]} facts={facts} onBack={onBack} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /reset progress/i }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/cannot be undone/i);
    fireEvent.click(screen.getByRole("button", { name: /keep progress/i }));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reset progress/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /back to the meadow/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
