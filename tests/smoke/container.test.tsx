import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "@/components/GameShell";
import { GrownUpsScreen } from "@/components/GrownUpsScreen";
import { DEFAULT_LEARNER_MODEL_CONFIG } from "@/learning/learnerConfig";
import { buildLearnerModel } from "@/learning/learnerModel";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { DEFAULT_POLICY_CONFIG } from "@/learning/policyConfig";
import { buildProgressReport } from "@/learning/report";
import { INITIAL_OFFLINE_STATUS } from "@/offline/serviceWorkerClient";
import { createMemoryRepository } from "@/persistence/memoryRepository";

vi.mock("@/game/GameCanvas", async () => {
  const { useEffect } = await import("react");
  function GameCanvas({ onReady }: { onReady: () => void }) {
    useEffect(() => onReady(), [onReady]);
    return <div data-testid="fake-canvas" />;
  }
  return { GameCanvas };
});

const facts = {
  buildId: "test",
  contentVersion: "abc",
  contentSource: "test",
  provisionalRules: true,
  persistent: true,
  offlinePhase: "disabled" as const,
  storedEvents: 0,
};
const report = () =>
  buildProgressReport(buildLearnerModel([], loadCurriculum(), DEFAULT_LEARNER_MODEL_CONFIG), loadCurriculum(), DEFAULT_POLICY_CONFIG);

describe("container exit button", () => {
  afterEach(() => {
    delete (window as { Android?: unknown }).Android;
  });

  it("is hidden in a normal browser", async () => {
    render(<GameShell repository={createMemoryRepository()} />);
    await screen.findByTestId("hud");
    expect(screen.queryByRole("button", { name: /leave the game/i })).not.toBeInTheDocument();
  });

  it("asks before leaving, with staying as the safe first choice", async () => {
    const closeApp = vi.fn<() => void>();
    window.Android = { closeApp };
    render(<GameShell repository={createMemoryRepository()} />);
    await screen.findByTestId("hud");

    fireEvent.click(screen.getByRole("button", { name: /leave the game/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Leave the forest?");
    expect(dialog).toHaveTextContent("Your stars are saved.");
    const buttons = screen.getAllByRole("button", { name: /stay and play|yes, leave/i });
    expect(buttons.map((b) => b.textContent)).toEqual(["Stay and play", "Yes, leave"]);
    expect(buttons[0]!).toHaveFocus();

    fireEvent.click(buttons[0]!);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(closeApp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /leave the game/i }));
    fireEvent.click(await screen.findByRole("button", { name: /yes, leave/i }));
    expect(closeApp).toHaveBeenCalledTimes(1);
  });
});

describe("grown-ups: version and container cards", () => {
  it("shows the build, lets a grown-up check for updates and apply one", () => {
    const onCheck = vi.fn<() => void>();
    const onApply = vi.fn<() => void>();
    const { rerender } = render(
      <GrownUpsScreen
        report={report()}
        stars={[]}
        facts={facts}
        updates={{ buildId: "build-7", offline: INITIAL_OFFLINE_STATUS, onCheck, onApply }}
        container={{ bridges: [], exitMethod: null }}
        onBack={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByText(/build build-7/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /update now/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no container app found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /check for updates/i }));
    expect(onCheck).toHaveBeenCalledTimes(1);

    rerender(
      <GrownUpsScreen
        report={report()}
        stars={[]}
        facts={facts}
        updates={{
          buildId: "build-7",
          offline: { ...INITIAL_OFFLINE_STATUS, updateReady: true, lastCheck: { at: 1, result: "update-ready" } },
          onCheck,
          onApply,
        }}
        container={{ bridges: [{ name: "Android", methods: ["cachedStatus", "closeApp"] }], exitMethod: "closeApp" }}
        onBack={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("A new version is ready.");
    fireEvent.click(screen.getByRole("button", { name: /update now/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/window\.Android/).closest("p")).toHaveTextContent("cachedStatus, closeApp");
    expect(screen.getByText(/exit button: on \(uses closeApp\)/i)).toBeInTheDocument();
  });
});
