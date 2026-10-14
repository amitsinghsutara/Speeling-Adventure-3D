import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JOYSTICK_RADIUS_PX, TouchControls } from "@/components/TouchControls";
import { createInputHub } from "@/game/input/inputHub";

function mockRect(element: HTMLElement, size: number) {
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: size,
      height: size,
      right: size,
      bottom: size,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("TouchControls", () => {
  it("drives the input hub from joystick pointer events", () => {
    const hub = createInputHub();
    render(<TouchControls input={hub} />);
    const joystick = screen.getByTestId("joystick");
    const knob = screen.getByTestId("joystick-knob");
    mockRect(joystick, 136);

    // Centre is (68, 68); push straight up past the rim.
    fireEvent.pointerDown(joystick, { pointerId: 1, clientX: 68, clientY: 68 });
    fireEvent.pointerMove(joystick, { pointerId: 1, clientX: 68, clientY: -40 });
    let move = hub.readMove();
    expect(move.y).toBeCloseTo(1);
    expect(move.x).toBeCloseTo(0);
    expect(move.run).toBe(true);
    expect(knob.style.transform).toBe(`translate(0px, ${-JOYSTICK_RADIUS_PX}px)`);

    // A second pointer must not hijack the stick.
    fireEvent.pointerMove(joystick, { pointerId: 2, clientX: 0, clientY: 68 });
    expect(hub.readMove().y).toBeCloseTo(1);

    fireEvent.pointerUp(joystick, { pointerId: 1 });
    move = hub.readMove();
    expect(move).toEqual({ x: 0, y: 0, run: false });
    expect(knob.style.transform).toBe("translate(0px, 0px)");
  });

  it("queues an interact press from the big button", () => {
    const hub = createInputHub();
    render(<TouchControls input={hub} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /interact/i }));
    expect(hub.consumeInteract()).toBe(true);
  });
});
