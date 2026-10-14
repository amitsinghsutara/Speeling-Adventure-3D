"use client";

import type { QualitySettings } from "@/game/graphics/quality";
import { Bushes } from "./Bushes";
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
import { WindDriver } from "./WindDriver";

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
      <fog attach="fog" args={["#cfeeff", 45, 150]} />
      <Lighting shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />
      <SkyDome />
      <Ground />
      <PathRibbon points={layout.mainPath} width={PATH_WIDTH} />
      <PathRibbon points={layout.branchPath} width={PATH_WIDTH * 0.8} />
      <Hills hills={layout.hills} />
      <Trees trees={layout.trees} />
      <Bushes bushes={layout.bushes} />
      <Rocks rocks={layout.rocks} />
      <Flowers flowers={layout.flowers} />
      <Clouds clouds={layout.clouds} reducedMotion={reducedMotion} />
      <WindDriver reducedMotion={reducedMotion} />
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
