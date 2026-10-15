"use client";

/** Shown on upright phones and tablets: the meadow is built for landscape. */
export function RotateDeviceOverlay() {
  return (
    <div className="overlay overlay--rotate" role="dialog" aria-labelledby="rotate-title" data-testid="rotate-device">
      <div className="rotate__phone" aria-hidden="true">
        <span className="rotate__arrow">⟳</span>
      </div>
      <h1 id="rotate-title" className="overlay__title">
        Turn your tablet sideways
      </h1>
      <p className="overlay__subtitle">Fern’s meadow is wider than it is tall.</p>
    </div>
  );
}
