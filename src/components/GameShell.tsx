"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  detectControlMode,
  readControlHints,
  type ControlMode,
} from "@/game/input/controlMode";
import { createInputHub } from "@/game/input/inputHub";
import { starsByQuest } from "@/game/quest/rewards";
import { INITIAL_QUEST_STATE, type QuestState } from "@/game/quest/questController";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { createCurriculumLearningService } from "@/learning/service";
import {
  createDefaultRepository,
  createProgressPersistence,
  type ProgressRepository,
} from "@/persistence";
import {
  progressChanged,
  progressFromQuestState,
  questStateFromProgress,
} from "@/persistence/progressMapping";
import type { RestoredState } from "@/persistence/progressPersistence";
import { offlineLabel } from "@/offline/serviceWorkerClient";
import { ChallengeDialog } from "./ChallengeDialog";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GrownUpsScreen, type LevelStars } from "./GrownUpsScreen";
import { Hud } from "./Hud";
import { LoadingScreen } from "./LoadingScreen";
import { RenderErrorScreen } from "./RenderErrorScreen";
import { TouchControls } from "./TouchControls";
import { useOfflineStatus } from "./useOfflineStatus";
import { useQuest } from "./useQuest";

/**
 * The 3D scene is loaded client-side only. `ssr: false` guarantees that
 * Three.js and WebGL are never touched during server rendering.
 */
const GameCanvas = dynamic(
  () => import("@/game/GameCanvas").then((mod) => mod.GameCanvas),
  { ssr: false, loading: () => null },
);

type ShellStatus =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; error: unknown };

const PROMPTS: Record<ControlMode, string> = {
  keyboard: "Press E to read the sign",
  touch: "Tap ! to read the sign",
};

export interface GameShellProps {
  /** Injected in tests; defaults to IndexedDB (or memory when unavailable). */
  repository?: ProgressRepository;
}

function wantsProgressReset(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("reset") === "progress";
}

export function GameShell({ repository: repositoryProp }: GameShellProps = {}) {
  const [status, setStatus] = useState<ShellStatus>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [grownUpsOpen, setGrownUpsOpen] = useState(false);
  const input = useMemo(() => createInputHub(), []);
  // Only consumed by client-only children rendered after the scene is ready.
  const controlMode = useMemo<ControlMode>(
    () =>
      typeof window === "undefined"
        ? "keyboard"
        : detectControlMode(readControlHints(window)),
    [],
  );

  // ---- Persistence -------------------------------------------------------
  const repository = useMemo(
    () => repositoryProp ?? createDefaultRepository(),
    [repositoryProp],
  );
  const persistence = useMemo(() => createProgressPersistence(repository), [repository]);
  const persistenceStatus = useSyncExternalStore(
    persistence.subscribe,
    persistence.getStatus,
    persistence.getStatus,
  );
  const [restored, setRestored] = useState<RestoredState | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (wantsProgressReset()) await repository.clearAll();
      const result = await persistence.restore();
      if (!cancelled) setRestored(result);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [repository, persistence]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") void persistence.flush();
    };
    const onPageHide = () => void persistence.flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [persistence]);

  // ---- Learning + quest --------------------------------------------------
  // Imported curriculum (src/learning/content/PROVENANCE.md). The service is
  // built once stored events are known so the learner model has its history;
  // new events and decisions stream to persistence.
  const learning = useMemo(
    () =>
      createCurriculumLearningService(loadCurriculum(), {
        history: restored?.events ?? [],
        sink: (event) => persistence.recordLearningEvent(event),
        decisionSink: (decision) => persistence.recordDecision(decision),
      }),
    [persistence, restored],
  );
  const initialQuestState = useMemo<QuestState>(
    () => (restored ? questStateFromProgress(restored.progress) : INITIAL_QUEST_STATE),
    [restored],
  );
  const quest = useQuest(learning, initialQuestState);
  const dialogOpen =
    quest.state.phase === "active" ||
    quest.state.phase === "completed" ||
    quest.state.phase === "error";
  const overlayOpen = dialogOpen || grownUpsOpen;

  // Persist meaningful changes only (completed quests and rewards).
  const lastSeenQuestState = useRef<QuestState | null>(null);
  useEffect(() => {
    const previous = lastSeenQuestState.current;
    lastSeenQuestState.current = quest.state;
    if (previous && progressChanged(previous, quest.state)) {
      void persistence.saveProgress(progressFromQuestState(quest.state));
    }
  }, [quest.state, persistence]);

  // Freeze movement and let keys reach the dialog while an overlay is open.
  useEffect(() => {
    input.setSuspended(overlayOpen);
  }, [input, overlayOpen]);

  // ---- Grown-ups screen -------------------------------------------------
  const openGrownUps = useCallback(() => setGrownUpsOpen(true), []);
  const closeGrownUps = useCallback(() => setGrownUpsOpen(false), []);
  const report = useMemo(
    () => (grownUpsOpen ? learning.getProgressReport() : null),
    [grownUpsOpen, learning],
  );
  const levelStars = useMemo<LevelStars[]>(() => {
    const perQuest = starsByQuest(quest.state.rewards.collectedRewardIds);
    const byLevel = new Map<number, LevelStars>();
    for (const p of learning.listPuzzles()) {
      const entry = byLevel.get(p.level) ?? { level: p.level, earned: 0, max: 0 };
      byLevel.set(p.level, {
        level: p.level,
        earned: entry.earned + (perQuest.get(p.questId) ?? 0),
        max: entry.max + 3,
      });
    }
    return [...byLevel.values()];
  }, [learning, quest.state.rewards.collectedRewardIds]);
  const resetProgress = useCallback(() => {
    const run = async () => {
      quest.controller.cancel();
      await repository.clearAll();
      const result = await persistence.restore();
      setRestored(result);
      setGrownUpsOpen(false);
    };
    void run();
  }, [quest.controller, repository, persistence]);

  const handleReady = useCallback(() => {
    setStatus({ kind: "ready" });
  }, []);

  const handleError = useCallback((error: unknown) => {
    setStatus({ kind: "error", error });
  }, []);

  const retry = useCallback(() => {
    input.reset();
    setStatus({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, [input]);

  const { setProximity, interact, controller } = quest;
  const submitAnswer = useCallback(
    (answer: string) => {
      controller.submitAnswer(answer);
    },
    [controller],
  );
  const advanceQuest = useCallback(() => controller.advance(), [controller]);
  const cancelQuest = useCallback(() => controller.cancel(), [controller]);
  const dismissQuest = useCallback(() => controller.dismiss(), [controller]);

  const prompt =
    quest.state.phase === "available" && quest.state.nearbyInteractable?.questId
      ? PROMPTS[controlMode]
      : null;

  const persistenceNote = !persistenceStatus.persistent
    ? "Progress is kept only until you close this page"
    : persistenceStatus.lastSave === "failed" || persistenceStatus.pendingEvents > 0
      ? "Saving your progress… (will keep trying)"
      : null;

  const ready = status.kind === "ready" && restored !== null;
  // Offline preparation starts once the scene has loaded all its assets.
  const offline = useOfflineStatus(ready);

  return (
    <div
      className="game-shell"
      data-status={status.kind}
      data-quest={quest.state.phase}
      data-restored={restored ? "true" : "false"}
    >
      {status.kind !== "error" ? (
        <GameErrorBoundary key={attempt} onError={handleError}>
          <GameCanvas
            input={input}
            activeInteractableId={quest.state.nearbyInteractable?.id ?? null}
            onProximity={setProximity}
            onInteract={interact}
            onReady={handleReady}
            onError={handleError}
          />
        </GameErrorBoundary>
      ) : null}
      {status.kind !== "error" && !ready ? (
        <LoadingScreen message="Waking up the meadow…" />
      ) : null}
      {ready ? (
        <>
          <Hud
            controlMode={controlMode}
            stars={quest.state.rewards.stars}
            prompt={prompt}
            note={persistenceNote}
            persistent={persistenceStatus.persistent}
            offlineLabel={offlineLabel(offline)}
            offlinePhase={offline.phase}
            onOpenGrownUps={openGrownUps}
          />
          {grownUpsOpen && report ? (
            <GrownUpsScreen
              report={report}
              stars={levelStars}
              facts={{
                buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
                contentVersion: learning.getContentInfo().contentVersion,
                contentSource: learning.getContentInfo().source,
                provisionalRules: learning.getContentInfo().provisional,
                persistent: persistenceStatus.persistent,
                offlinePhase: offline.phase,
                storedEvents: learning.getEvents().length,
              }}
              onBack={closeGrownUps}
              onReset={resetProgress}
            />
          ) : null}
          {controlMode === "touch" && !overlayOpen ? <TouchControls input={input} /> : null}
          {dialogOpen ? (
            <ChallengeDialog
              quest={quest.state}
              onSubmit={submitAnswer}
              onAdvance={advanceQuest}
              onCancel={cancelQuest}
              onDismiss={dismissQuest}
            />
          ) : null}
        </>
      ) : null}
      {status.kind === "error" ? (
        <RenderErrorScreen error={status.error} onRetry={retry} />
      ) : null}
    </div>
  );
}
