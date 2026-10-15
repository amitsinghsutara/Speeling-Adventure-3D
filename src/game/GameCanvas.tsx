"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { RendererError } from "./graphics/errors";
import {
  QUALITY_PRESETS,
  readDeviceHints,
  resolveQualityLevel,
  type DeviceHints,
} from "./graphics/quality";
import { describeWebGLSupport } from "./graphics/webgl";
import type { InputHub } from "./input/inputHub";
import type { WorldInteractable } from "./quest/interactables";
import { attachKeyboard } from "./input/keyboard";
import { PlayerRig } from "./PlayerRig";
import { generateMeadowLayout } from "./world/layout";
import { MeadowScene, type InteractableStates } from "./world/MeadowScene";

export interface GameCanvasProps {
  input: InputHub;
  /** Which level's scene to build. Changing it rebuilds the world. */
  level: number;
  /** Puzzle and gate states by interactable id. */
  interactableStates: InteractableStates;
  /** Interactable currently in range; drives the signpost affordance. */
  activeInteractableId: string | null;
  onProximity: (interactable: WorldInteractable | null) => void;
  onInteract: (interactable: WorldInteractable) => void;
  /** Called once the first frame has actually been rendered. */
  onReady: () => void;
  /** Called when the renderer cannot start or stops working. */
  onError: (error: unknown) => void;
}

/** Pointer capture can throw for synthetic or already-released pointers; never let that break input. */
function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Ignore: capture is a nicety, not a requirement.
  }
}

const FALLBACK_HINTS: DeviceHints = {
  coarsePointer: false,
  reducedMotion: false,
};

/**
 * Client-only entry point for the 3D world. This module is imported with
 * `ssr: false`, so nothing in here runs on the server.
 */
export function GameCanvas({
  input,
  level,
  interactableStates,
  activeInteractableId,
  onProximity,
  onInteract,
  onReady,
  onError,
}: GameCanvasProps) {
  const support = useMemo(() => describeWebGLSupport(), []);
  const hints = useMemo(
    () => (typeof window === "undefined" ? FALLBACK_HINTS : readDeviceHints(window)),
    [],
  );
  const quality = useMemo(() => {
    const override =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("quality");
    return QUALITY_PRESETS[resolveQualityLevel(hints, override)];
  }, [hints]);
  const layout = useMemo(
    () =>
      generateMeadowLayout({
        level,
        treeCount: quality.treeCount,
        forestTreeCount: quality.forestTreeCount,
        bushCount: quality.bushCount,
        grassCount: quality.grassCount,
        flowerCount: quality.flowerCount,
        rockCount: quality.rockCount,
        cloudCount: quality.cloudCount,
      }),
    [quality, level],
  );

  useEffect(() => {
    if (!support.supported) {
      onError(new RendererError("unsupported", support.reason));
    }
  }, [support, onError]);

  useEffect(() => attachKeyboard(input, window), [input]);

  // Drag anywhere on the canvas (mouse or finger) to orbit the camera.
  const lookPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (lookPointer.current) return;
    lookPointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    capturePointer(event.currentTarget, event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = lookPointer.current;
    if (!active || active.id !== event.pointerId) return;
    input.addLook(event.clientX - active.x, event.clientY - active.y);
    active.x = event.clientX;
    active.y = event.clientY;
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointer.current?.id === event.pointerId) lookPointer.current = null;
  };

  if (!support.supported) return null;

  return (
    <div
      className="game-canvas"
      data-quality={quality.level}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <Canvas
        flat
        dpr={[1, quality.maxPixelRatio]}
        shadows={quality.shadows ? "percentage" : false}
        frameloop="always"
        gl={{
          antialias: quality.antialias,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
        }}
        camera={{
          fov: 50,
          near: 0.1,
          far: 600,
          position: [...layout.cameraStart],
        }}
      >
        <RendererWatchdog onError={onError} />
        <FirstFrameSignal onReady={onReady} />
        <Suspense fallback={null}>
          <MeadowScene
            layout={layout}
            quality={quality}
            reducedMotion={hints.reducedMotion}
            activeInteractableId={activeInteractableId}
            interactableStates={interactableStates}
          />
          <PlayerRig
            layout={layout}
            input={input}
            reducedMotion={hints.reducedMotion}
            onProximity={onProximity}
            onInteract={onInteract}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

function RendererWatchdog({ onError }: { onError: (error: unknown) => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const element = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onError(
        new RendererError(
          "context-lost",
          "The WebGL context was lost (webglcontextlost).",
        ),
      );
    };
    element.addEventListener("webglcontextlost", handleLost);
    return () => element.removeEventListener("webglcontextlost", handleLost);
  }, [gl, onError]);
  return null;
}

function FirstFrameSignal({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onReady();
  });
  return null;
}
