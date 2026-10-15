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
import { lowerQuality } from "@/game/graphics/perfMonitor";
import {
  QUALITY_PRESETS,
  detectDefaultQuality,
  readDeviceHints,
  type QualityLevel,
} from "@/game/graphics/quality";
import {
  effectiveQuality,
  readAutoFloor,
  readQualityPreference,
  writeAutoFloor,
  writeQualityPreference,
  type QualityPreference,
} from "@/game/graphics/qualityPreference";
import { getPerfStats } from "@/game/graphics/perfStats";
import type { WorldInteractable } from "@/game/quest/interactables";
import { INITIAL_QUEST_STATE, type QuestState } from "@/game/quest/questController";
import { starsByQuest } from "@/game/quest/rewards";
import { sceneInteractables } from "@/game/world/layout";
import type { InteractableStates } from "@/game/world/MeadowScene";
import { MAX_LEVEL, sceneForLevel } from "@/game/world/scenes";
import { loadCurriculum } from "@/learning/loadCurriculum";
import { createCurriculumLearningService, type LearningService } from "@/learning/service";
import { offlineLabel } from "@/offline/serviceWorkerClient";
import { describeContainer, detectExitBridge } from "@/platform/containerBridge";
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
import { ChallengeDialog } from "./ChallengeDialog";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GrownUpsScreen, type LevelStars } from "./GrownUpsScreen";
import { Hud } from "./Hud";
import { LoadingScreen } from "./LoadingScreen";
import { NoticeDialog } from "./NoticeDialog";
import { RenderErrorScreen } from "./RenderErrorScreen";
import { RotateDeviceOverlay } from "./RotateDeviceOverlay";
import { TouchControls } from "./TouchControls";
import { useLandscape } from "./useLandscape";
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

interface Notice {
  readonly icon: string;
  readonly title: string;
  readonly message: string;
  readonly travelTo?: number;
  /** "Leave the forest?" for the container exit button. */
  readonly exit?: boolean;
}

const PROMPTS: Record<ControlMode, { sign: string; gate: string }> = {
  keyboard: { sign: "Press E to read the sign", gate: "Press E to open the gate" },
  touch: { sign: "Tap ! to read the sign", gate: "Tap ! to open the gate" },
};

export interface GameShellProps {
  /** Injected in tests; defaults to IndexedDB (or memory when unavailable). */
  repository?: ProgressRepository;
}

function wantsProgressReset(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("reset") === "progress";
}

/** The scene a returning player starts in: the furthest unlocked level. */
export function startLevelFor(learning: LearningService, completedQuestIds: readonly string[]): number {
  let level = 1;
  for (let candidate = 1; candidate <= MAX_LEVEL; candidate += 1) {
    const info = learning.getLevelInfo(candidate, completedQuestIds);
    if (!info || info.status === "locked") break;
    level = candidate;
  }
  return level;
}

/** Sign and gate states for a level's interactables, from the learning layer. */
export function interactableStatesFor(
  learning: LearningService,
  level: number,
  completedQuestIds: readonly string[],
): InteractableStates {
  const states: Record<string, InteractableStates[string]> = {};
  for (const item of sceneInteractables(level)) {
    if (item.questId) {
      states[item.id] = learning.getQuestInfo(item.questId, completedQuestIds)?.status ?? "locked";
    } else if (item.travelToLevel !== undefined) {
      const info = learning.getLevelInfo(item.travelToLevel, completedQuestIds);
      states[item.id] = info && info.status !== "locked" ? "open" : "locked";
    }
  }
  return states;
}

export function GameShell({ repository: repositoryProp }: GameShellProps = {}) {
  const [status, setStatus] = useState<ShellStatus>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [grownUpsOpen, setGrownUpsOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const input = useMemo(() => createInputHub(), []);
  // Native container (Android WebView) bridge: capability-detected, hidden in browsers.
  const exitBridge = useMemo(() => detectExitBridge(), []);
  const container = useMemo(() => describeContainer(), []);

  // ---- Graphics quality ---------------------------------------------------
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(() =>
    readQualityPreference(storage),
  );
  const [autoFloor, setAutoFloor] = useState<QualityLevel | null>(() => readAutoFloor(storage));
  const heuristicQuality = useMemo<QualityLevel>(
    () => (typeof window === "undefined" ? "medium" : detectDefaultQuality(readDeviceHints(window))),
    [],
  );
  const urlQuality =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("quality");
  const qualityLevel = effectiveQuality({
    urlOverride: urlQuality,
    preference: qualityPreference,
    heuristic: heuristicQuality,
    autoFloor,
  });
  const [qualityNote, setQualityNote] = useState<string | null>(null);
  const changeQualityPreference = useCallback(
    (value: QualityPreference) => {
      setQualityPreference(value);
      writeQualityPreference(storage, value);
      if (value === "auto") {
        setAutoFloor(null);
        writeAutoFloor(storage, null);
      }
    },
    [storage],
  );
  // Only consumed by client-only children rendered after the scene is ready.
  const controlMode = useMemo<ControlMode>(
    () =>
      typeof window === "undefined"
        ? "keyboard"
        : detectControlMode(readControlHints(window)),
    [],
  );
  // Phones and tablets play sideways; upright ones are asked to turn.
  const portrait = useLandscape(controlMode === "touch");

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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (wantsProgressReset()) await repository.clearAll();
      const result = await persistence.restore();
      if (cancelled) return;
      setRestored(result);
      const completed = result.progress?.completedQuestIds ?? [];
      setLevel(startLevelFor(createCurriculumLearningService(loadCurriculum()), completed));
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

  const dialogOpen =
    quest.state.phase === "active" ||
    quest.state.phase === "completed" ||
    quest.state.phase === "error";
  const overlayOpen = dialogOpen || grownUpsOpen || notice !== null || portrait;

  // Safety net: after sustained low frame rate, step the preset down once
  // (only in auto mode, never mid-puzzle) and remember the floor.
  const suggestDowngrade = useCallback(() => {
    if (qualityPreference !== "auto" || urlQuality || overlayOpen) return;
    const lower = lowerQuality(qualityLevel);
    if (!lower) return;
    setAutoFloor(lower);
    writeAutoFloor(storage, lower);
    setQualityNote(`Switched to ${QUALITY_PRESETS[lower].level} graphics to keep things smooth`);
    setStatus({ kind: "loading" });
  }, [qualityPreference, urlQuality, qualityLevel, storage, overlayOpen]);
  useEffect(() => {
    if (!qualityNote) return;
    const timer = setTimeout(() => setQualityNote(null), 6000);
    return () => clearTimeout(timer);
  }, [qualityNote]);

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

  // ---- Scene + travel ----------------------------------------------------
  const currentLevel = level ?? 1;
  const completedQuestIds = quest.state.completedQuestIds;
  const interactableStates = useMemo(
    () => interactableStatesFor(learning, currentLevel, completedQuestIds),
    [learning, currentLevel, completedQuestIds],
  );
  const levelInfo = learning.getLevelInfo(currentLevel, completedQuestIds);
  const sceneLabel = levelInfo
    ? `${sceneForLevel(currentLevel).name} · ${levelInfo.completedCount}/${levelInfo.puzzleCount}`
    : sceneForLevel(currentLevel).name;

  const travelTo = useCallback(
    (target: number) => {
      setNotice(null);
      quest.controller.cancel();
      input.reset();
      setStatus({ kind: "loading" });
      setLevel(target);
    },
    [quest.controller, input],
  );

  const handleInteract = useCallback(
    (interactable: WorldInteractable) => {
      if (interactable.travelToLevel === undefined) {
        quest.interact();
        return;
      }
      const target = interactable.travelToLevel;
      const targetScene = sceneForLevel(target);
      const info = learning.getLevelInfo(target, quest.state.completedQuestIds);
      if (!info) {
        setNotice({ icon: "🌲", title: "The path ends here", message: "There is nothing beyond this gate yet." });
        return;
      }
      if (info.status === "locked") {
        const here = learning.getLevelInfo(currentLevel, quest.state.completedQuestIds);
        const done = here?.completedCount ?? 0;
        const total = here?.puzzleCount ?? 5;
        setNotice({
          icon: "🔒",
          title: "The gate is closed",
          message: `Finish all the signs in this meadow to open it. You have done ${done} of ${total}.`,
        });
        return;
      }
      setNotice({
        icon: target > currentLevel ? "🌟" : "🏡",
        title: target > currentLevel ? "The gate is open!" : "Go back?",
        message:
          target > currentLevel
            ? `Through here is ${targetScene.name}, with new words to spell.`
            : `This leads back to ${targetScene.name}.`,
        travelTo: target,
      });
    },
    [quest, learning, currentLevel],
  );

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
      setStatus({ kind: "loading" });
      setLevel(1);
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

  const { setProximity, controller } = quest;
  const submitAnswer = useCallback(
    (answer: string) => {
      controller.submitAnswer(answer);
    },
    [controller],
  );
  const advanceQuest = useCallback(() => controller.advance(), [controller]);
  const cancelQuest = useCallback(() => controller.cancel(), [controller]);
  const dismissQuest = useCallback(() => controller.dismiss(), [controller]);

  const nearby = quest.state.nearbyInteractable;
  const prompt =
    quest.state.phase === "available" && nearby
      ? nearby.travelToLevel !== undefined
        ? PROMPTS[controlMode].gate
        : nearby.questId
          ? PROMPTS[controlMode].sign
          : null
      : null;

  const persistenceNote = !persistenceStatus.persistent
    ? "Progress is kept only until you close this page"
    : persistenceStatus.lastSave === "failed" || persistenceStatus.pendingEvents > 0
      ? "Saving your progress… (will keep trying)"
      : qualityNote;

  const ready = status.kind === "ready" && restored !== null && level !== null;
  // Offline preparation starts once the scene has loaded all its assets.
  const { status: offline, controller: offlineController } = useOfflineStatus(ready);
  const noticeTravel = notice?.travelTo;
  const askToExit = useCallback(() => {
    setNotice({
      icon: "🚪",
      title: "Leave the forest?",
      message: dialogOpen
        ? "Your stars are saved. This puzzle will start again next time. Come back soon!"
        : "Your stars are saved. Come back soon!",
      exit: true,
    });
  }, [dialogOpen]);
  const confirmExit = useCallback(() => {
    setNotice(null);
    exitBridge.exit();
  }, [exitBridge]);
  // Offer a waiting update only when it cannot interrupt play.
  const updateBanner = offline.updateReady && !overlayOpen;

  return (
    <div
      className="game-shell"
      data-status={status.kind}
      data-quest={quest.state.phase}
      data-restored={restored ? "true" : "false"}
      data-level={level ?? ""}
    >
      {status.kind !== "error" && level !== null ? (
        <GameErrorBoundary key={attempt} onError={handleError}>
          <GameCanvas
            input={input}
            qualityLevel={qualityLevel}
            onSuggestDowngrade={suggestDowngrade}
            level={level}
            interactableStates={interactableStates}
            activeInteractableId={nearby?.id ?? null}
            onProximity={setProximity}
            onInteract={handleInteract}
            onReady={handleReady}
            onError={handleError}
          />
        </GameErrorBoundary>
      ) : null}
      {status.kind !== "error" && !ready ? (
        <LoadingScreen
          message={level !== null ? `Walking to ${sceneForLevel(level).name}…` : "Waking up the meadow…"}
        />
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
            sceneLabel={sceneLabel}
            onExit={exitBridge.canExit ? askToExit : undefined}
            updateReady={updateBanner}
            onUpdateNow={() => offlineController.applyUpdate()}
          />
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
          {notice ? (
            <NoticeDialog
              icon={notice.icon}
              title={notice.title}
              message={notice.message}
              {...(noticeTravel !== undefined
                ? { actionLabel: "Go through", onAction: () => travelTo(noticeTravel) }
                : notice.exit
                  ? { actionLabel: "Yes, leave", onAction: confirmExit, risky: true }
                  : {})}
              onClose={() => setNotice(null)}
            />
          ) : null}
          {portrait ? <RotateDeviceOverlay /> : null}
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
              container={container}
              updates={{
                buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
                offline,
                onCheck: () => void offlineController.checkForUpdates(),
                onApply: () => offlineController.applyUpdate(),
              }}
              graphics={{
                preference: qualityPreference,
                effective: qualityLevel,
                urlOverride: urlQuality !== null,
                stats: { ...getPerfStats() },
                onChange: changeQualityPreference,
              }}
              onBack={closeGrownUps}
              onReset={resetProgress}
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
