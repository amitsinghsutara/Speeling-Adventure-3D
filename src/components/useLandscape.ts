"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { enforceLandscape, isPortrait, watchOrientation, type OrientationReport } from "@/platform/orientation";

const subscribe = (onChange: () => void) => watchOrientation(onChange);
const getSnapshot = () => isPortrait();
const getServerSnapshot = () => false;

export interface LandscapeBinding {
  /** The device is upright and should be turned (touch devices only). */
  readonly portrait: boolean;
  /** What the last attempt achieved, for the grown-ups screen. */
  readonly report: OrientationReport | null;
  /** Call from a tap: goes fullscreen and asks the browser to lock landscape. */
  readonly requestLandscape: () => void;
}

/**
 * Keeps touch devices in landscape where the platform allows it, and reports
 * whether the device is still upright so the shell can ask the child to turn it.
 * Keyboard devices are never asked to turn.
 */
export function useLandscape(enabled: boolean): LandscapeBinding {
  const portrait = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [report, setReport] = useState<OrientationReport | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void enforceLandscape(undefined, { trigger: "start" }).then((r) => {
      if (!cancelled) setReport(r);
    });
    // Browsers only grant orientation locks after a user gesture; try once
    // more (without fullscreen, which would be too surprising) on the first touch.
    const retry = () => {
      void enforceLandscape(undefined, { trigger: "gesture" }).then((r) => {
        if (!cancelled) setReport(r);
      });
    };
    window.addEventListener("pointerdown", retry, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", retry);
    };
  }, [enabled]);

  const requestLandscape = useCallback(() => {
    void enforceLandscape(undefined, { fullscreen: true, trigger: "tap" }).then(setReport);
  }, []);

  return { portrait: enabled && portrait, report, requestLandscape };
}
