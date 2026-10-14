import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "@/components/GameShell";
import type { WorldInteractable } from "@/game/quest/interactables";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { createMemoryRepository } from "@/persistence/memoryRepository";

const stub = vi.hoisted(() => ({
  mode: "ready" as "ready" | "error",
  mounts: 0,
}));

const SIGN: WorldInteractable = {
  id: "sign-test",
  kind: "spelling-sign",
  promptKey: "prompt.sign.read",
  position: [0, 0, 0],
  interactionRadius: 2,
  questId: "level-1/puzzle-1",
};

vi.mock("@/game/GameCanvas", async () => {
  const { useEffect } = await import("react");
  const { RendererError } = await import("@/game/graphics/errors");
  function GameCanvas({
    onReady,
    onError,
    onProximity,
    onInteract,
  }: {
    onReady: () => void;
    onError: (error: unknown) => void;
    onProximity: (interactable: WorldInteractable | null) => void;
    onInteract: (interactable: WorldInteractable) => void;
  }) {
    useEffect(() => {
      stub.mounts += 1;
      if (stub.mode === "ready") {
        onReady();
      } else {
        onError(new RendererError("unsupported", "no webgl in test"));
      }
    }, [onReady, onError]);
    return (
      <div data-testid="fake-canvas">
        <button type="button" onClick={() => onProximity(SIGN)}>
          fake-approach
        </button>
        <button type="button" onClick={() => onInteract(SIGN)}>
          fake-interact
        </button>
      </div>
    );
  }
  return { GameCanvas };
});

async function completeFirstChallenge() {
  fireEvent.click(screen.getByText("fake-approach"));
  await screen.findByText(/press e to read the sign/i);
  fireEvent.click(screen.getByText("fake-interact"));
  await screen.findByRole("dialog");
  // Puzzle 1 is the first five level-1 items in curriculum order.
  const targets = loadCurriculum()
    .items.filter((i) => i.level === 1)
    .sort((a, b) => a.sequenceInLevel - b.sequenceInLevel)
    .slice(0, 5)
    .map((i) => i.target);
  for (const [index, target] of targets.entries()) {
    await screen.findByText(new RegExp(`word ${index + 1} of 5`, "i"));
    fireEvent.click(screen.getByRole("button", { name: target }));
    if (index < targets.length - 1) {
      fireEvent.click(await screen.findByRole("button", { name: /next word/i }));
    }
  }
  await screen.findByText(/puzzle finished/i);
  fireEvent.click(screen.getByRole("button", { name: /^back to the meadow$/i }));
}

describe("GameShell", () => {
  beforeEach(() => {
    stub.mode = "ready";
    stub.mounts = 0;
  });

  it("shows the loading screen first, then the HUD once the scene is ready", async () => {
    const { container } = render(<GameShell repository={createMemoryRepository()} />);
    const shell = container.firstElementChild;
    expect(shell).toHaveAttribute("data-status", "loading");
    expect(screen.getByRole("status")).toHaveTextContent("Waking up the meadow");

    await screen.findByTestId("hud");
    expect(shell).toHaveAttribute("data-status", "ready");
    expect(shell).toHaveAttribute("data-restored", "true");
    expect(screen.queryByText(/waking up/i)).not.toBeInTheDocument();
    // jsdom reports no touch points, so the keyboard hint is shown.
    expect(screen.getByText(/WASD or arrows/i)).toBeVisible();
    expect(screen.queryByTestId("touch-controls")).not.toBeInTheDocument();
  });

  it("shows a recoverable error and remounts the scene on retry", async () => {
    stub.mode = "error";
    const { container } = render(<GameShell repository={createMemoryRepository()} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/can't draw the forest/i);
    expect(alert).toHaveTextContent("no webgl in test");
    expect(container.firstElementChild).toHaveAttribute("data-status", "error");
    expect(screen.queryByTestId("fake-canvas")).not.toBeInTheDocument();

    stub.mode = "ready";
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await screen.findByTestId("hud");
    expect(container.firstElementChild).toHaveAttribute("data-status", "ready");
    expect(stub.mounts).toBe(2);
  });

  it("completes a quest, persists it, and restores the star after a reload", async () => {
    const repository = createMemoryRepository();
    const first = render(<GameShell repository={repository} />);
    await screen.findByTestId("hud");
    expect(screen.getByLabelText(/0 stars collected/i)).toBeInTheDocument();

    await completeFirstChallenge();
    expect(await screen.findByLabelText(/3 stars collected/i)).toBeInTheDocument();

    // Wait for the save to land, then simulate a reload by remounting.
    await vi.waitFor(async () => {
      expect((await repository.loadProgress()).status).toBe("ok");
    });
    const events = await repository.loadLearningEvents();
    expect(events.events).toHaveLength(5);
    expect(events.events.every((e) => e.correct && e.puzzleId === "level-1/puzzle-1")).toBe(true);
    first.unmount();

    render(<GameShell repository={repository} />);
    await screen.findByTestId("hud");
    expect(screen.getByLabelText(/3 stars collected/i)).toBeInTheDocument();

    // The sign can be replayed after a reload; cancelling keeps the star count.
    fireEvent.click(screen.getByText("fake-approach"));
    await screen.findByText(/press e to read the sign/i);
    fireEvent.click(screen.getByText("fake-interact"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/listen and pick/i);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/3 stars collected/i)).toBeInTheDocument();
  });

  it("starts fresh when stored progress is corrupted", async () => {
    const repository = createMemoryRepository({ seedProgress: { current: { bad: true } } });
    render(<GameShell repository={repository} />);
    await screen.findByTestId("hud");
    expect(screen.getByLabelText(/0 stars collected/i)).toBeInTheDocument();
    expect((await repository.loadProgress()).status).toBe("empty");
  });
});
