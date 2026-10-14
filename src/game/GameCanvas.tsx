"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { RendererError } from "./graphics/errors";
import {
  QUALITY_PRESETS,
  detectDefaultQuality,
  readDeviceHints,
  type DeviceHints,
} from "./graphics/quality";
import { describeWebGLSupport } from "./graphics/webgl";
import { generateMeadowLayout } from "./world/layout";
import { MeadowScene } from "./world/MeadowScene";

export interface GameCanvasProps {
  /** Called once the first frame has actually been rendered. */
  onReady: () => void;
  /** Called when the renderer cannot start or stops working. */
  onError: (error: unknown) => void;
}

const FALLBACK_HINTS: DeviceHints = {
  coarsePointer: false,
  reducedMotion: false,
};

/**
 * Client-only entry point for the 3D world. This module is imported with
 * `ssr: false`, so nothing in here runs on the server.
 */
export function GameCanvas({ onReady, onError }: GameCanvasProps) {
  const support = useMemo(() => describeWebGLSupport(), []);
  const hints = useMemo(
    () => (typeof window === "undefined" ? FALLBACK_HINTS : readDeviceHints(window)),
    [],
  );
  const quality = QUALITY_PRESETS[detectDefaultQuality(hints)];
  const layout = useMemo(
    () =>
      generateMeadowLayout({
        treeCount: quality.treeCount,
        flowerCount: quality.flowerCount,
        rockCount: quality.rockCount,
        cloudCount: quality.cloudCount,
      }),
    [quality],
  );

  useEffect(() => {
    if (!support.supported) {
      onError(new RendererError("unsupported", support.reason));
    }
  }, [support, onError]);

  if (!support.supported) return null;

  return (
    <div className="game-canvas" data-quality={quality.level}>
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
          />
        </Suspense>
        {/* Temporary look-around controls until the third-person camera lands. */}
        <OrbitControls
          makeDefault
          target={[...layout.cameraTarget]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          minDistance={4}
          maxDistance={18}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2 - 0.08}
        />
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
