import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "@/components/GameShell";

const stub = vi.hoisted(() => ({
  mode: "ready" as "ready" | "error",
  mounts: 0,
}));

vi.mock("@/game/GameCanvas", async () => {
  const { useEffect } = await import("react");
  const { RendererError } = await import("@/game/graphics/errors");
  function GameCanvas({
    onReady,
    onError,
  }: {
    onReady: () => void;
    onError: (error: unknown) => void;
  }) {
    useEffect(() => {
      stub.mounts += 1;
      if (stub.mode === "ready") {
        onReady();
      } else {
        onError(new RendererError("unsupported", "no webgl in test"));
      }
    }, [onReady, onError]);
    return <div data-testid="fake-canvas" />;
  }
  return { GameCanvas };
});

describe("GameShell", () => {
  beforeEach(() => {
    stub.mode = "ready";
    stub.mounts = 0;
  });

  it("shows the loading screen first, then the HUD once the scene is ready", async () => {
    const { container } = render(<GameShell />);
    const shell = container.firstElementChild;
    expect(shell).toHaveAttribute("data-status", "loading");
    expect(screen.getByRole("status")).toHaveTextContent("Waking up the meadow");

    await screen.findByTestId("hud");
    expect(shell).toHaveAttribute("data-status", "ready");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(/look around the meadow/i)).toBeVisible();
  });

  it("shows a recoverable error and remounts the scene on retry", async () => {
    stub.mode = "error";
    const { container } = render(<GameShell />);

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
});
