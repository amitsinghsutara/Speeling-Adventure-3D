/**
 * Framework-free input hub. Keyboard, virtual joystick and drag-to-look all
 * write into it; the game loop reads from it once per frame. It holds no React
 * state so input never triggers renders.
 */
export interface MoveIntent {
  /** Right (+) / left (−) in camera space, −1..1. */
  readonly x: number;
  /** Forward (+) / back (−) in camera space, −1..1. */
  readonly y: number;
  readonly run: boolean;
}

export interface LookDelta {
  readonly x: number;
  readonly y: number;
}

export interface InputHub {
  setKeyboardMove(x: number, y: number): void;
  setKeyboardRun(run: boolean): void;
  setJoystick(x: number, y: number, active: boolean): void;
  addLook(dx: number, dy: number): void;
  queueInteract(): void;
  /** Current movement intent, magnitude clamped to 1. */
  readMove(): MoveIntent;
  /** Accumulated look delta since the last call; resets to zero. */
  consumeLook(): LookDelta;
  /** True once per queued interact press. */
  consumeInteract(): boolean;
  /** While suspended (e.g. a dialog is open) movement reads as zero and keys pass through. */
  setSuspended(suspended: boolean): void;
  isSuspended(): boolean;
  reset(): void;
}

/** Joystick deflection (0..1) above which the character runs. */
export const JOYSTICK_RUN_THRESHOLD = 0.8;

export function clampMagnitude(x: number, y: number, max = 1): [number, number] {
  const length = Math.hypot(x, y);
  if (length <= max || length === 0) return [x, y];
  return [(x / length) * max, (y / length) * max];
}

export function createInputHub(): InputHub {
  let keyX = 0;
  let keyY = 0;
  let keyRun = false;
  let joyX = 0;
  let joyY = 0;
  let joyActive = false;
  let lookX = 0;
  let lookY = 0;
  let interactQueued = false;
  let suspended = false;

  return {
    setKeyboardMove(x, y) {
      keyX = x;
      keyY = y;
    },
    setKeyboardRun(run) {
      keyRun = run;
    },
    setJoystick(x, y, active) {
      joyX = x;
      joyY = y;
      joyActive = active;
    },
    addLook(dx, dy) {
      lookX += dx;
      lookY += dy;
    },
    queueInteract() {
      interactQueued = true;
    },
    readMove() {
      if (suspended) return { x: 0, y: 0, run: false };
      if (joyActive) {
        const [x, y] = clampMagnitude(joyX, joyY);
        return { x, y, run: Math.hypot(x, y) >= JOYSTICK_RUN_THRESHOLD };
      }
      const [x, y] = clampMagnitude(keyX, keyY);
      return { x, y, run: keyRun && (x !== 0 || y !== 0) };
    },
    consumeLook() {
      const delta = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return delta;
    },
    consumeInteract() {
      const queued = interactQueued;
      interactQueued = false;
      return queued;
    },
    setSuspended(value) {
      suspended = value;
      if (value) {
        joyActive = false;
        lookX = 0;
        lookY = 0;
        interactQueued = false;
      }
    },
    isSuspended() {
      return suspended;
    },
    reset() {
      keyX = 0;
      keyY = 0;
      keyRun = false;
      joyX = 0;
      joyY = 0;
      joyActive = false;
      lookX = 0;
      lookY = 0;
      interactQueued = false;
    },
  };
}
