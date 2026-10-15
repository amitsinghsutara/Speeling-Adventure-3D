import type { ControlMode } from "@/game/input/controlMode";
import { HoldButton } from "./HoldButton";

export interface HudProps {
  controlMode: ControlMode;
  stars: number;
  /** Shown when an interactable is in range. */
  prompt: string | null;
  /** Quiet persistence notice (e.g. saving retry), or null. */
  note?: string | null;
  /** Whether progress is backed by durable storage (exposed for diagnostics). */
  persistent?: boolean;
  /** Offline readiness text, or null when nothing needs saying. */
  offlineLabel?: string | null;
  offlinePhase?: string;
  /** Opens the grown-ups screen after a press-and-hold. */
  onOpenGrownUps?: () => void;
  /** Current scene name and puzzle progress, e.g. "Sunny Meadow · 2/5". */
  sceneLabel?: string | null;
}

const HINTS: Record<ControlMode, string> = {
  keyboard: "Move: WASD or arrows · Run: Shift · Look: drag",
  touch: "Move with the joystick · Drag to look around",
};

export function Hud({
  controlMode,
  stars,
  prompt,
  note = null,
  persistent = true,
  offlineLabel = null,
  offlinePhase = "disabled",
  onOpenGrownUps,
  sceneLabel = null,
}: HudProps) {
  return (
    <div
      className="hud"
      data-testid="hud"
      data-persistent={persistent ? "true" : "false"}
      data-offline={offlinePhase}
    >
      <div className="hud__top">
        <div className="hud__badge">{sceneLabel ?? "Spelling Adventure 3D"}</div>
        <div className="hud__top-right">
          {onOpenGrownUps ? (
            <HoldButton label="For grown-ups: press and hold to open" onComplete={onOpenGrownUps}>
              For grown-ups
            </HoldButton>
          ) : null}
          <div className="hud__badge hud__stars" aria-label={`${stars} stars collected`}>
            <span aria-hidden="true">⭐</span> {stars}
          </div>
        </div>
      </div>
      {offlineLabel ? (
        <div className="hud__offline" role="status">
          {offlineLabel}
        </div>
      ) : null}
      <div className="hud__bottom">
        {prompt ? (
          <div className="hud__prompt" role="status" aria-live="polite">
            {prompt}
          </div>
        ) : null}
        {note ? (
          <div className="hud__note" role="status">
            {note}
          </div>
        ) : null}
        <div className="hud__hint">{HINTS[controlMode]}</div>
      </div>
    </div>
  );
}
