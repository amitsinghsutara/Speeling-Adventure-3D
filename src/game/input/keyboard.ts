import type { InputHub } from "./inputHub";

export type MoveKey = "forward" | "back" | "left" | "right";
export type KeyAction = MoveKey | "run" | "interact";

/** Keyed by `KeyboardEvent.code` so layouts other than QWERTY still work by position. */
export const KEY_BINDINGS: Readonly<Record<string, KeyAction>> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "run",
  ShiftRight: "run",
  KeyE: "interact",
  Space: "interact",
  Enter: "interact",
};

export function moveVectorFromKeys(
  pressed: ReadonlySet<MoveKey>,
): [number, number] {
  const x = (pressed.has("right") ? 1 : 0) - (pressed.has("left") ? 1 : 0);
  const y = (pressed.has("forward") ? 1 : 0) - (pressed.has("back") ? 1 : 0);
  return [x, y];
}

interface KeyboardEventLike {
  readonly code?: string;
  readonly repeat?: boolean;
  readonly target?: unknown;
  preventDefault?: () => void;
}

/** Structural subset of `window` (method syntax keeps listener types bivariant). */
export interface KeyboardTarget {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

function isEditable(target: unknown): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== "string") return false;
  return (
    el.isContentEditable === true ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
}

/**
 * Binds keyboard events to the hub. Returns a detach function. Arrow and
 * space keys are prevented from scrolling the page while the game has focus.
 */
export function attachKeyboard(
  hub: InputHub,
  target: KeyboardTarget,
): () => void {
  const pressed = new Set<MoveKey>();
  let shift = false;

  const publish = () => {
    const [x, y] = moveVectorFromKeys(pressed);
    hub.setKeyboardMove(x, y);
    hub.setKeyboardRun(shift);
  };

  const onKeyDown = (raw: Event) => {
    const event = raw as KeyboardEventLike;
    if (hub.isSuspended() || isEditable(event.target)) return;
    const action = event.code ? KEY_BINDINGS[event.code] : undefined;
    if (!action) return;
    event.preventDefault?.();
    if (action === "run") {
      shift = true;
    } else if (action === "interact") {
      if (!event.repeat) hub.queueInteract();
      return;
    } else {
      pressed.add(action);
    }
    publish();
  };

  const onKeyUp = (raw: Event) => {
    const event = raw as KeyboardEventLike;
    const action = event.code ? KEY_BINDINGS[event.code] : undefined;
    if (!action) return;
    if (action === "run") {
      shift = false;
    } else if (action !== "interact") {
      pressed.delete(action);
    }
    publish();
  };

  const onBlur = () => {
    pressed.clear();
    shift = false;
    publish();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", onBlur);
    onBlur();
  };
}
