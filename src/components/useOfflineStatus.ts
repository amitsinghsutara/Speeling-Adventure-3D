"use client";

import { useEffect, useState } from "react";
import {
  INITIAL_OFFLINE_STATUS,
  prepareOffline,
  type OfflineStatus,
} from "@/offline/serviceWorkerClient";

/**
 * Starts offline preparation once the game is ready (so the resource list
 * is complete) and tracks online/offline transitions.
 */
export function useOfflineStatus(enabled: boolean): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>(INITIAL_OFFLINE_STATUS);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    void prepareOffline(window, {
      buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
      onChange: (next) => {
        if (!cancelled) setStatus(next);
      },
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setStatus((s) => ({ ...s, online: window.navigator.onLine }));
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return status;
}
