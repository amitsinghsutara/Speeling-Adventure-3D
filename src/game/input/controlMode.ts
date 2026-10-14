export type ControlMode = "keyboard" | "touch";

export interface ControlHints {
  readonly coarsePointer: boolean;
  readonly maxTouchPoints: number;
  /** Explicit override, e.g. from a `?controls=touch` query parameter. */
  readonly override?: string | null;
}

/**
 * Decides whether to show the on-screen joystick and interact button. The
 * keyboard stays attached in both modes, so a touchscreen laptop gets both.
 */
export function detectControlMode(hints: ControlHints): ControlMode {
  if (hints.override === "touch" || hints.override === "keyboard") {
    return hints.override;
  }
  return hints.coarsePointer || hints.maxTouchPoints > 0 ? "touch" : "keyboard";
}

interface WindowLike {
  navigator: { maxTouchPoints?: number };
  location: { search: string };
  matchMedia?: (query: string) => { matches: boolean };
}

export function readControlHints(win: WindowLike): ControlHints {
  const coarsePointer =
    typeof win.matchMedia === "function"
      ? win.matchMedia("(pointer: coarse)").matches
      : false;
  return {
    coarsePointer,
    maxTouchPoints: win.navigator.maxTouchPoints ?? 0,
    override: new URLSearchParams(win.location.search).get("controls"),
  };
}
