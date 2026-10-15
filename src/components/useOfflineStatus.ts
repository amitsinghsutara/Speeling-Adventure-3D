"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { wordAudioUrl } from "@/game/audio/wordAudio";
import { loadCurriculum } from "@/learning/loadCurriculum";
import {
  INITIAL_OFFLINE_STATUS,
  createOfflineController,
  type OfflineController,
  type OfflineStatus,
} from "@/offline/serviceWorkerClient";

const inert: OfflineController = {
  getSnapshot: () => INITIAL_OFFLINE_STATUS,
  subscribe: () => () => {},
  start: async () => INITIAL_OFFLINE_STATUS,
  checkForUpdates: async () => "unsupported",
  applyUpdate: () => {},
  stop: () => {},
};

export interface OfflineBinding {
  readonly status: OfflineStatus;
  readonly controller: OfflineController;
}

/**
 * Starts offline preparation once the game is ready (so the resource list is
 * complete), precaching every word recording too, and keeps update checks
 * running for the life of the page.
 */
export function useOfflineStatus(enabled: boolean): OfflineBinding {
  const controller = useMemo<OfflineController>(() => {
    if (typeof window === "undefined") return inert;
    return createOfflineController(window, {
      buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
      extraUrls: loadCurriculum().items.map((item) => wordAudioUrl(item.target)),
    });
  }, []);
  const status = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => INITIAL_OFFLINE_STATUS);

  useEffect(() => {
    if (!enabled) return;
    void controller.start();
  }, [enabled, controller]);

  useEffect(() => () => controller.stop(), [controller]);

  return { status, controller };
}
