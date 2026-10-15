"use client";

import { useLayoutEffect } from "react";
import type { QualitySettings } from "@/game/graphics/quality";
import { Bushes } from "./Bushes";
import { Clouds } from "./Clouds";
import { Flowers } from "./Flowers";
import { Gate } from "./Gate";
import { Grass } from "./Grass";
import { Ground } from "./Ground";
import { Hills } from "./Hills";
import { Lighting } from "./Lighting";
import { PATH_WIDTH, type MeadowLayout } from "./layout";
import { getSharedMaterials } from "./materials";
import { PathRibbon } from "./PathRibbon";
import { Rocks } from "./Rocks";
import { Signpost, type SignState } from "./Signpost";
import { SkyDome } from "./SkyDome";
import { Trees } from "./Trees";
import { WindDriver } from "./WindDriver";

export interface InteractableStates {
  readonly [id: string]: SignState | "open" | undefined;
}

export interface MeadowSceneProps {
  layout: MeadowLayout;
  quality: QualitySettings;
  reducedMotion: boolean;
  activeInteractableId: string | null;
  /** Puzzle/gate states by interactable id, from the learning layer. */
  interactableStates: InteractableStates;
}

/** Composes a scene from pure layout data and its palette. The player is a separate rig. */
export function MeadowScene({
  layout,
  quality,
  reducedMotion,
  activeInteractableId,
  interactableStates,
}: MeadowSceneProps) {
  const palette = layout.palette;

  // Shared materials are singletons; recolour the few flat ones per scene.
  useLayoutEffect(() => {
    const m = getSharedMaterials();
    m.ground.color.set(palette.ground);
    m.path.color.set(palette.path);
  }, [palette]);

  return (
    <>
      <fog attach="fog" args={[palette.fog, 55, 200]} />
      <Lighting shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />
      <SkyDome topColor={palette.skyTop} horizonColor={palette.skyHorizon} />
      <Ground />
      <Grass tufts={layout.grass} colors={palette.grass} />
      {layout.paths.map((points, i) => (
        <PathRibbon key={i} points={points} width={i === 0 ? PATH_WIDTH : PATH_WIDTH * 0.8} />
      ))}
      <Hills hills={layout.hills} colors={palette.hill} />
      <Trees trees={layout.trees} canopyColors={palette.canopy} coniferColors={palette.conifer} />
      <Bushes bushes={layout.bushes} colors={palette.bush} />
      <Rocks rocks={layout.rocks} />
      <Flowers flowers={layout.flowers} colors={palette.flower} />
      <Clouds clouds={layout.clouds} reducedMotion={reducedMotion} />
      <WindDriver reducedMotion={reducedMotion} />
      {layout.interactables.map((item) => {
        const state = interactableStates[item.id];
        if (item.travelToLevel !== undefined) {
          return (
            <Gate
              key={item.id}
              position={item.position}
              facing={item.travelToLevel > layout.scene.level ? "north" : "south"}
              state={state === "open" ? "open" : "locked"}
              highlighted={item.id === activeInteractableId}
              reducedMotion={reducedMotion}
            />
          );
        }
        return (
          <Signpost
            key={item.id}
            position={item.position}
            highlighted={item.id === activeInteractableId}
            state={state === "completed" || state === "locked" ? state : "available"}
            reducedMotion={reducedMotion}
          />
        );
      })}
    </>
  );
}
