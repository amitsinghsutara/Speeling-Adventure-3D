"use client";

import { useEffect, useSyncExternalStore } from "react";
import { enforceLandscape, isPortrait, watchOrientation } from "@/platform/orientation";

const subscribe = (onChange: () => void) => watchOrientation(onChange);
const getSnapshot = () => isPortrait();
const getServerSnapshot = () => false;

/**
 * Keeps touch devices in landscape where the platform allows it, and reports
 * whether the device is still upright so the shell can ask the child to turn it.
 * Keyboard devices are never asked to turn.
 */
export function useLandscape(enabled: boolean): boolean {
  const portrait = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!enabled) return;
    void enforceLandscape();
    // Browsers only grant orientation locks after a user gesture (and often
    // only in fullscreen); try once more on the first touch.
    const retry = () => void enforceLandscape();
    window.addEventListener("pointerdown", retry, { once: true });
    return () => window.removeEventListener("pointerdown", retry);
  }, [enabled]);

  return enabled && portrait;
}
