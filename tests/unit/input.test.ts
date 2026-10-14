import { describe, expect, it, vi } from "vitest";
import { detectControlMode, readControlHints } from "@/game/input/controlMode";
import {
  JOYSTICK_RUN_THRESHOLD,
  clampMagnitude,
  createInputHub,
} from "@/game/input/inputHub";
import { sampleJoystick } from "@/game/input/joystick";
import { attachKeyboard, moveVectorFromKeys } from "@/game/input/keyboard";

describe("createInputHub", () => {
  it("normalises diagonal keyboard input and applies shift to run", () => {
    const hub = createInputHub();
    hub.setKeyboardMove(1, 1);
    hub.setKeyboardRun(true);
    const move = hub.readMove();
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.run).toBe(true);
  });

  it("does not report running when shift is held without movement", () => {
    const hub = createInputHub();
    hub.setKeyboardRun(true);
    expect(hub.readMove().run).toBe(false);
  });

  it("prefers an active joystick over the keyboard and runs near the rim", () => {
    const hub = createInputHub();
    hub.setKeyboardMove(0, 1);
    hub.setJoystick(0.3, 0, true);
    expect(hub.readMove()).toEqual({ x: 0.3, y: 0, run: false });
    hub.setJoystick(0, JOYSTICK_RUN_THRESHOLD, true);
    expect(hub.readMove().run).toBe(true);
    hub.setJoystick(0, 0, false);
    expect(hub.readMove()).toEqual({ x: 0, y: 1, run: false });
  });

  it("accumulates look deltas until consumed", () => {
    const hub = createInputHub();
    hub.addLook(3, -1);
    hub.addLook(2, 1);
    expect(hub.consumeLook()).toEqual({ x: 5, y: 0 });
    expect(hub.consumeLook()).toEqual({ x: 0, y: 0 });
  });

  it("reports an interact press exactly once", () => {
    const hub = createInputHub();
    expect(hub.consumeInteract()).toBe(false);
    hub.queueInteract();
    hub.queueInteract();
    expect(hub.consumeInteract()).toBe(true);
    expect(hub.consumeInteract()).toBe(false);
  });

  it("reset clears everything", () => {
    const hub = createInputHub();
    hub.setJoystick(1, 0, true);
    hub.addLook(4, 4);
    hub.queueInteract();
    hub.reset();
    expect(hub.readMove()).toEqual({ x: 0, y: 0, run: false });
    expect(hub.consumeLook()).toEqual({ x: 0, y: 0 });
    expect(hub.consumeInteract()).toBe(false);
  });
});

describe("clampMagnitude", () => {
  it("leaves short vectors alone and clamps long ones", () => {
    expect(clampMagnitude(0.3, 0.4)).toEqual([0.3, 0.4]);
    const [x, y] = clampMagnitude(3, 4);
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(0.8);
  });
});

describe("keyboard", () => {
  it("maps WASD and arrows to a movement vector", () => {
    expect(moveVectorFromKeys(new Set(["forward"]))).toEqual([0, 1]);
    expect(moveVectorFromKeys(new Set(["back", "right"]))).toEqual([1, -1]);
    expect(moveVectorFromKeys(new Set(["left", "right"]))).toEqual([0, 0]);
  });

  it("drives the hub from key events and detaches cleanly", () => {
    const listeners = new Map<string, (event: Event) => void>();
    const target = {
      addEventListener: vi.fn((type: string, fn: (event: Event) => void) => {
        listeners.set(type, fn);
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type);
      }),
    };
    const hub = createInputHub();
    const detach = attachKeyboard(hub, target);
    const fire = (type: string, code: string, repeat = false) =>
      listeners.get(type)?.({ code, repeat, target: null, preventDefault: vi.fn() } as unknown as Event);

    fire("keydown", "KeyW");
    fire("keydown", "ArrowRight");
    fire("keydown", "ShiftLeft");
    let move = hub.readMove();
    expect(move.run).toBe(true);
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(Math.SQRT1_2);

    fire("keydown", "Space");
    fire("keydown", "Space", true);
    expect(hub.consumeInteract()).toBe(true);
    expect(hub.consumeInteract()).toBe(false);

    fire("keyup", "KeyW");
    fire("keyup", "ShiftLeft");
    move = hub.readMove();
    expect(move).toEqual({ x: 1, y: 0, run: false });

    fire("blur", "");
    expect(hub.readMove()).toEqual({ x: 0, y: 0, run: false });

    detach();
    expect(target.removeEventListener).toHaveBeenCalledTimes(3);
  });

  it("ignores keys typed into editable fields", () => {
    const listeners = new Map<string, (event: Event) => void>();
    const target = {
      addEventListener: (type: string, fn: (event: Event) => void) => {
        listeners.set(type, fn);
      },
      removeEventListener: () => undefined,
    };
    const hub = createInputHub();
    attachKeyboard(hub, target);
    listeners.get("keydown")?.({
      code: "KeyW",
      repeat: false,
      target: { tagName: "INPUT" },
      preventDefault: vi.fn(),
    } as unknown as Event);
    expect(hub.readMove().y).toBe(0);
  });
});

describe("sampleJoystick", () => {
  it("clamps the knob to the radius and maps screen-up to forward", () => {
    const sample = sampleJoystick(0, -200, 50);
    expect(sample.knobY).toBeCloseTo(-50);
    expect(sample.intentY).toBeCloseTo(1);
    expect(sample.intentX).toBeCloseTo(0);
  });

  it("applies a dead zone near the centre", () => {
    const sample = sampleJoystick(2, 2, 50);
    expect(sample.intentX).toBe(0);
    expect(sample.intentY).toBe(0);
    expect(sample.knobX).toBeCloseTo(2);
  });

  it("returns zero for no deflection", () => {
    expect(sampleJoystick(0, 0, 50)).toEqual({
      knobX: 0,
      knobY: 0,
      intentX: 0,
      intentY: 0,
    });
  });
});

describe("control mode", () => {
  it("shows touch controls for coarse pointers or touch screens", () => {
    expect(detectControlMode({ coarsePointer: true, maxTouchPoints: 0 })).toBe("touch");
    expect(detectControlMode({ coarsePointer: false, maxTouchPoints: 5 })).toBe("touch");
    expect(detectControlMode({ coarsePointer: false, maxTouchPoints: 0 })).toBe("keyboard");
  });

  it("honours an explicit override", () => {
    expect(
      detectControlMode({ coarsePointer: true, maxTouchPoints: 5, override: "keyboard" }),
    ).toBe("keyboard");
    expect(
      detectControlMode({ coarsePointer: false, maxTouchPoints: 0, override: "touch" }),
    ).toBe("touch");
  });

  it("reads hints from a window-like object", () => {
    const hints = readControlHints({
      navigator: { maxTouchPoints: 2 },
      location: { search: "?controls=touch" },
      matchMedia: () => ({ matches: false }),
    });
    expect(hints).toEqual({ coarsePointer: false, maxTouchPoints: 2, override: "touch" });
  });
});
