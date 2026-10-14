/**
 * Pure joystick geometry shared by the on-screen control and its tests.
 * Screen space: +y is down, so the forward intent is the negated y axis.
 */
export interface JoystickSample {
  /** Knob offset in pixels, clamped to the radius. */
  readonly knobX: number;
  readonly knobY: number;
  /** Normalised intent in camera space: x right, y forward. */
  readonly intentX: number;
  readonly intentY: number;
}

export function sampleJoystick(
  dx: number,
  dy: number,
  radius: number,
  deadZone = 0.12,
): JoystickSample {
  const length = Math.hypot(dx, dy);
  if (length === 0 || radius <= 0) {
    return { knobX: 0, knobY: 0, intentX: 0, intentY: 0 };
  }
  const clamped = Math.min(length, radius);
  const knobX = (dx / length) * clamped;
  const knobY = (dy / length) * clamped;
  const deflection = clamped / radius;
  if (deflection < deadZone) {
    return { knobX, knobY, intentX: 0, intentY: 0 };
  }
  // Rescale so the dead zone edge maps to 0 and the rim to 1.
  const scaled = (deflection - deadZone) / (1 - deadZone);
  return {
    knobX,
    knobY,
    intentX: (dx / length) * scaled,
    intentY: (-dy / length) * scaled,
  };
}
