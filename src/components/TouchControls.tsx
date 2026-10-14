"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { InputHub } from "@/game/input/inputHub";
import { sampleJoystick } from "@/game/input/joystick";

export const JOYSTICK_RADIUS_PX = 56;

/** Pointer capture can throw for synthetic or already-released pointers; never let that break input. */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Ignore: capture is a nicety, not a requirement.
  }
}

export interface TouchControlsProps {
  input: InputHub;
}

/** On-screen joystick (bottom-left) and a large interact button (bottom-right). */
export function TouchControls({ input }: TouchControlsProps) {
  return (
    <div className="touch-controls" data-testid="touch-controls">
      <VirtualJoystick input={input} />
      <button
        type="button"
        className="touch-button"
        aria-label="Interact"
        onPointerDown={(event) => {
          event.preventDefault();
          input.queueInteract();
        }}
      >
        !
      </button>
    </div>
  );
}

function VirtualJoystick({ input }: { input: InputHub }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const sample = sampleJoystick(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2),
      JOYSTICK_RADIUS_PX,
    );
    if (knob.current) {
      knob.current.style.transform = `translate(${sample.knobX}px, ${sample.knobY}px)`;
    }
    input.setJoystick(sample.intentX, sample.intentY, true);
  };

  const release = () => {
    pointerId.current = null;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    input.setJoystick(0, 0, false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return;
    event.preventDefault();
    pointerId.current = event.pointerId;
    capturePointer(event.currentTarget, event.pointerId);
    update(event.clientX, event.clientY);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    update(event.clientX, event.clientY);
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    release();
  };

  return (
    <div
      ref={base}
      className="joystick"
      role="application"
      aria-label="Move Fern"
      data-testid="joystick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={knob} className="joystick__knob" data-testid="joystick-knob" />
    </div>
  );
}
