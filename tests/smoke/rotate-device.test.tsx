import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "@/components/GameShell";
import { createMemoryRepository } from "@/persistence/memoryRepository";

vi.mock("@/game/GameCanvas", async () => {
  const { useEffect } = await import("react");
  function GameCanvas({ onReady }: { onReady: () => void }) {
    useEffect(() => onReady(), [onReady]);
    return <div data-testid="fake-canvas" />;
  }
  return { GameCanvas };
});

type Listener = () => void;

/** A fake matchMedia whose portrait query can be flipped from the test. */
function fakeMatchMedia(initialPortrait: boolean) {
  const listeners = new Set<Listener>();
  const state = { portrait: initialPortrait };
  const matchMedia = (query: string) => ({
    get matches() {
      return query.includes("orientation: portrait") ? state.portrait : false;
    },
    media: query,
    addEventListener: (_: "change", fn: Listener) => listeners.add(fn),
    removeEventListener: (_: "change", fn: Listener) => listeners.delete(fn),
  });
  const turn = (portrait: boolean) => {
    state.portrait = portrait;
    listeners.forEach((l) => l());
  };
  return { matchMedia, turn };
}

describe("landscape on touch devices", () => {
  const original = { matchMedia: window.matchMedia, maxTouchPoints: navigator.maxTouchPoints, search: window.location.search };
  let media: ReturnType<typeof fakeMatchMedia>;

  beforeEach(() => {
    media = fakeMatchMedia(true);
    Object.defineProperty(navigator, "maxTouchPoints", { value: 2, configurable: true });
    window.matchMedia = media.matchMedia as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = original.matchMedia;
    Object.defineProperty(navigator, "maxTouchPoints", { value: original.maxTouchPoints, configurable: true });
    delete (window as { Android?: unknown }).Android;
  });

  it("asks an upright touch device to turn, hides the joystick, and lets play resume once turned", async () => {
    render(<GameShell repository={createMemoryRepository()} />);
    await screen.findByTestId("hud");
    expect(screen.getByTestId("rotate-device")).toHaveTextContent(/turn your tablet sideways/i);
    expect(screen.queryByTestId("touch-controls")).not.toBeInTheDocument();

    act(() => media.turn(false));
    expect(screen.queryByTestId("rotate-device")).not.toBeInTheDocument();
    expect(screen.getByTestId("touch-controls")).toBeInTheDocument();

    act(() => media.turn(true));
    expect(screen.getByTestId("rotate-device")).toBeInTheDocument();
  });

  it("asks the container app for landscape on start", async () => {
    const setContainerAppOrientation = vi.fn<(value: string) => void>();
    window.Android = { setContainerAppOrientation };
    render(<GameShell repository={createMemoryRepository()} />);
    await screen.findByTestId("hud");
    expect(setContainerAppOrientation).toHaveBeenCalledWith("landscape");
  });

  it("never asks a keyboard device to turn", async () => {
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    render(<GameShell repository={createMemoryRepository()} />);
    await screen.findByTestId("hud");
    expect(screen.queryByTestId("rotate-device")).not.toBeInTheDocument();
  });
});
