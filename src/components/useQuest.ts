"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { WorldInteractable } from "@/game/quest/interactables";
import {
  INITIAL_QUEST_STATE,
  createQuestController,
  type QuestController,
  type QuestState,
} from "@/game/quest/questController";
import type { LearningService } from "@/learning/service";

export interface QuestBinding {
  readonly state: QuestState;
  readonly controller: QuestController;
  readonly setProximity: (interactable: WorldInteractable | null) => void;
  readonly interact: () => void;
}

/** Binds the framework-free quest controller to React. */
export function useQuest(
  service: LearningService,
  initial: QuestState = INITIAL_QUEST_STATE,
): QuestBinding {
  const controller = useMemo(
    () => createQuestController(service, initial),
    [service, initial],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
  const setProximity = useCallback(
    (interactable: WorldInteractable | null) => controller.setProximity(interactable),
    [controller],
  );
  const interact = useCallback(() => {
    controller.interact();
  }, [controller]);
  return { state, controller, setProximity, interact };
}
