import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHARACTER_TUNING,
  cameraRelativeDirection,
  createCharacterState,
  shortestAngleDelta,
  stepCharacter,
  updateMoveFrame,
  wrapAngle,
  type CharacterState,
} from "@/game/character/controller";
import type { MoveIntent } from "@/game/input/inputHub";

const IDLE: MoveIntent = { x: 0, y: 0, run: false };
const FORWARD: MoveIntent = { x: 0, y: 1, run: false };
const RUN_FORWARD: MoveIntent = { x: 0, y: 1, run: true };

function simulate(
  intent: MoveIntent,
  seconds: number,
  hz: number,
  cameraYaw = 0,
  start: CharacterState = createCharacterState([0, 0, 0], 0),
): CharacterState {
  let state = start;
  const dt = 1 / hz;
  for (let i = 0; i < seconds * hz; i += 1) {
    state = stepCharacter(state, intent, cameraYaw, dt);
  }
  return state;
}

describe("cameraRelativeDirection", () => {
  it("maps stick-forward to away from a camera behind the character", () => {
    const [x, z] = cameraRelativeDirection(FORWARD, 0);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-1);
  });

  it("maps stick-right to the camera's right", () => {
    const [x, z] = cameraRelativeDirection({ x: 1, y: 0, run: false }, 0);
    expect(x).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });

  it("rotates with the camera yaw", () => {
    const [x, z] = cameraRelativeDirection(FORWARD, Math.PI / 2);
    expect(x).toBeCloseTo(-1);
    expect(z).toBeCloseTo(0);
  });
});

describe("shortestAngleDelta", () => {
  it("takes the short way round", () => {
    expect(shortestAngleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
    expect(shortestAngleDelta(-3, 3)).toBeCloseTo(-(Math.PI * 2 - 6));
  });
});

describe("stepCharacter", () => {
  it("stays idle with no intent", () => {
    const state = simulate(IDLE, 1, 60);
    expect(state.speed).toBe(0);
    expect(state.position).toEqual([0, 0, 0]);
    expect(state.animation).toBe("idle");
  });

  it("walks forward and reaches walking speed", () => {
    const state = simulate(FORWARD, 2, 60);
    expect(state.speed).toBeCloseTo(DEFAULT_CHARACTER_TUNING.walkSpeed, 2);
    expect(state.position[2]).toBeLessThan(-4);
    expect(state.position[0]).toBeCloseTo(0, 5);
    expect(state.animation).toBe("walk");
  });

  it("runs faster than it walks", () => {
    const run = simulate(RUN_FORWARD, 2, 60);
    const walk = simulate(FORWARD, 2, 60);
    expect(run.speed).toBeCloseTo(DEFAULT_CHARACTER_TUNING.runSpeed, 2);
    expect(run.position[2]).toBeLessThan(walk.position[2]);
    expect(run.animation).toBe("run");
  });

  it("is frame-rate independent", () => {
    const at30 = simulate(RUN_FORWARD, 2, 30);
    const at144 = simulate(RUN_FORWARD, 2, 144);
    expect(Math.abs(at30.position[2] - at144.position[2])).toBeLessThan(0.15);
    expect(Math.abs(at30.speed - at144.speed)).toBeLessThan(0.05);
  });

  it("turns to face the direction of travel", () => {
    const state = simulate({ x: 1, y: 0, run: false }, 1, 60);
    // Facing +X means yaw = atan2(-1, 0) = -π/2.
    expect(state.yaw).toBeCloseTo(-Math.PI / 2, 2);
  });

  it("decelerates to idle after input stops", () => {
    const moving = simulate(FORWARD, 1, 60);
    const stopped = simulate(IDLE, 1, 60, 0, moving);
    expect(stopped.speed).toBeLessThan(0.01);
    expect(stopped.animation).toBe("idle");
    expect(stopped.yaw).toBe(moving.yaw);
  });

  it("clamps diagonal input so it is not faster than straight", () => {
    const diagonal = simulate({ x: 1, y: 1, run: false }, 2, 60);
    expect(diagonal.speed).toBeCloseTo(DEFAULT_CHARACTER_TUNING.walkSpeed, 2);
  });
});

describe("wrapAngle", () => {
  it("wraps into (−π, π]", () => {
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe("updateMoveFrame", () => {
  it("latches the camera yaw when a push starts and holds it while held", () => {
    let frame = updateMoveFrame(null, 0, 0.2, false);
    expect(frame).toBeNull();
    frame = updateMoveFrame(frame, 1, 0.2, false);
    expect(frame).toBe(0.2);
    frame = updateMoveFrame(frame, 1, 1.4, false);
    expect(frame).toBe(0.2);
  });

  it("re-latches on a manual look and clears on release", () => {
    let frame = updateMoveFrame(0.2, 1, 1.4, true);
    expect(frame).toBe(1.4);
    frame = updateMoveFrame(frame, 0, 2.0, false);
    expect(frame).toBeNull();
  });
});
