"use client";

export interface RotateDeviceOverlayProps {
  /** Tap handler: goes fullscreen and asks the browser to lock landscape. */
  onRequestLandscape: () => void;
}

/**
 * Shown on upright phones and tablets: the meadow is built for landscape.
 * Turning the device works on its own; the button is for browsers that will
 * only lock orientation from a tap (and only in fullscreen).
 */
export function RotateDeviceOverlay({ onRequestLandscape }: RotateDeviceOverlayProps) {
  return (
    <div className="overlay overlay--rotate" role="dialog" aria-labelledby="rotate-title" data-testid="rotate-device">
      <div className="rotate__phone" aria-hidden="true">
        <span className="rotate__arrow">⟳</span>
      </div>
      <h1 id="rotate-title" className="overlay__title">
        Turn your tablet sideways
      </h1>
      <p className="overlay__subtitle">Fern’s meadow is wider than it is tall.</p>
      <button type="button" className="button rotate__button" onClick={onRequestLandscape}>
        Turn it for me
      </button>
    </div>
  );
}
