"use client";

import type { QualitySettings } from "@/game/graphics/quality";
import { Clouds } from "./Clouds";
import { Flowers } from "./Flowers";
import { Ground } from "./Ground";
import { Hills } from "./Hills";
import { Lighting } from "./Lighting";
import { PATH_WIDTH, type MeadowLayout } from "./layout";
import { PathRibbon } from "./PathRibbon";
import { Rocks } from "./Rocks";
import { Signpost } from "./Signpost";
import { SkyDome } from "./SkyDome";
import { Trees } from "./Trees";

export interface MeadowSceneProps {
  layout: MeadowLayout;
  quality: QualitySettings;
  reducedMotion: boolean;
  activeInteractableId: string | null;
}

/** Composes the static meadow from pure layout data. The player is a separate rig. */
export function MeadowScene({
  layout,
  quality,
  reducedMotion,
  activeInteractableId,
}: MeadowSceneProps) {
  return (
    <>
      <fog attach="fog" args={["#d4f0ff", 60, 170]} />
      <Lighting shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />
      <SkyDome />
      <Ground />
      <PathRibbon points={layout.mainPath} width={PATH_WIDTH} />
      <PathRibbon points={layout.branchPath} width={PATH_WIDTH * 0.8} />
      <Hills hills={layout.hills} />
      <Trees trees={layout.trees} />
      <Rocks rocks={layout.rocks} />
      <Flowers flowers={layout.flowers} />
      <Clouds clouds={layout.clouds} reducedMotion={reducedMotion} />
      {layout.interactables.map((item) => (
        <Signpost
          key={item.id}
          position={item.position}
          highlighted={item.id === activeInteractableId}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
