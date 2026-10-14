"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { Hud } from "./Hud";
import { LoadingScreen } from "./LoadingScreen";
import { RenderErrorScreen } from "./RenderErrorScreen";

/**
 * The 3D scene is loaded client-side only. `ssr: false` guarantees that
 * Three.js and WebGL are never touched during server rendering.
 */
const GameCanvas = dynamic(
  () => import("@/game/GameCanvas").then((mod) => mod.GameCanvas),
  { ssr: false, loading: () => null },
);

type ShellStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; error: unknown };

export function GameShell() {
  const [status, setStatus] = useState<ShellStatus>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const handleReady = useCallback(() => {
    setStatus({ kind: "ready" });
  }, []);

  const handleError = useCallback((error: unknown) => {
    setStatus({ kind: "error", error });
  }, []);

  const retry = useCallback(() => {
    setStatus({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="game-shell" data-status={status.kind}>
      {status.kind !== "error" ? (
        <GameErrorBoundary key={attempt} onError={handleError}>
          <GameCanvas onReady={handleReady} onError={handleError} />
        </GameErrorBoundary>
      ) : null}
      {status.kind === "loading" ? (
        <LoadingScreen message="Waking up the meadow…" />
      ) : null}
      {status.kind === "ready" ? <Hud /> : null}
      {status.kind === "error" ? (
        <RenderErrorScreen error={status.error} onRetry={retry} />
      ) : null}
    </div>
  );
}
