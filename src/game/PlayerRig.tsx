"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { createCameraState, stepFollowCamera } from "./camera/followCamera";
import {
  DEFAULT_CHARACTER_TUNING,
  createCharacterState,
  stepCharacter,
  updateMoveFrame,
} from "./character/controller";
import { FernPlaceholder } from "./character/FernPlaceholder";
import type { CharacterAnimationState } from "./character/types";
import { getDebugSnapshot } from "./debug";
import type { InputHub } from "./input/inputHub";
import {
  findInteractableInRange,
  type WorldInteractable,
} from "./quest/interactables";
import { buildColliders, resolveCircleCollisions } from "./world/collision";
import type { MeadowLayout } from "./world/layout";

export interface PlayerRigProps {
  layout: MeadowLayout;
  input: InputHub;
  reducedMotion: boolean;
  /** Called when the nearest in-range interactable changes (rare). */
  onProximity: (interactable: WorldInteractable | null) => void;
  /** Called on an interact press while something is in range. */
  onInteract: (interactable: WorldInteractable) => void;
}

/** Largest simulation step; protects against tunnelling after a tab was hidden. */
const MAX_DT = 0.05;

/**
 * Owns the high-frequency player state. Every frame it reads the input hub,
 * steps the pure controller and camera, resolves collisions and writes the
 * results straight onto Three.js objects. React state changes only on
 * animation transitions (a few times per second at most).
 */
export function PlayerRig({
  layout,
  input,
  reducedMotion,
  onProximity,
  onInteract,
}: PlayerRigProps) {
  const fern = useRef<THREE.Group>(null);
  const character = useRef(
    createCharacterState(layout.fernSpawn, layout.fernSpawnYaw),
  );
  const cameraState = useRef(
    createCameraState(layout.fernSpawn, layout.fernSpawnYaw),
  );
  const colliders = useMemo(() => buildColliders(layout), [layout]);
  const camera = useThree((state) => state.camera);
  const [animation, setAnimation] = useState<CharacterAnimationState>("idle");
  const lastAnimation = useRef<CharacterAnimationState>("idle");
  const moveFrameYaw = useRef<number | null>(null);
  const nearbyId = useRef<string | null>(null);

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, MAX_DT);
    const intent = input.readMove();
    const look = input.consumeLook();
    const interactPressed = input.consumeInteract();

    moveFrameYaw.current = updateMoveFrame(
      moveFrameYaw.current,
      Math.hypot(intent.x, intent.y),
      cameraState.current.yaw,
      look.x !== 0,
    );
    const stepped = stepCharacter(
      character.current,
      intent,
      moveFrameYaw.current ?? cameraState.current.yaw,
      dt,
    );
    const resolved = resolveCircleCollisions(
      stepped.position[0],
      stepped.position[2],
      DEFAULT_CHARACTER_TUNING.radius,
      colliders.walk,
      colliders.boundsRadius,
    );
    const next = {
      ...stepped,
      position: [resolved.x, stepped.position[1], resolved.z] as const,
    };
    character.current = next;

    const group = fern.current;
    if (group) {
      group.position.set(next.position[0], next.position[1], next.position[2]);
      group.rotation.y = next.yaw;
    }

    const nearby = findInteractableInRange(next.position, layout.interactables);
    if ((nearby?.id ?? null) !== nearbyId.current) {
      nearbyId.current = nearby?.id ?? null;
      onProximity(nearby);
    }
    if (interactPressed && nearby && !input.isSuspended()) {
      onInteract(nearby);
    }

    if (next.animation !== lastAnimation.current) {
      lastAnimation.current = next.animation;
      setAnimation(next.animation);
    }

    const cam = stepFollowCamera(
      cameraState.current,
      next.position,
      next.yaw,
      next.speed > 0.3,
      look,
      dt,
      colliders.camera,
    );
    cameraState.current = cam;
    camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    camera.lookAt(cam.lookAt[0], cam.lookAt[1], cam.lookAt[2]);

    // Dev-only window snapshot; a no-op in production builds.
    const debug = getDebugSnapshot();
    if (debug) {
      debug.x = next.position[0];
      debug.y = next.position[1];
      debug.z = next.position[2];
      debug.yaw = next.yaw;
      debug.speed = next.speed;
      debug.animation = next.animation;
      debug.cameraYaw = cam.yaw;
      debug.frames += 1;
    }
  });

  return (
    <FernPlaceholder
      ref={fern}
      animation={animation}
      reducedMotion={reducedMotion}
    />
  );
}
