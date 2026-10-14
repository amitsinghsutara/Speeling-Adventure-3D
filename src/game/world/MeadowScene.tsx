"use client";

import { FernPlaceholder } from "@/game/character/FernPlaceholder";
import type { QualitySettings } from "@/game/graphics/quality";
import { Clouds } from "./Clouds";
import { Flowers } from "./Flowers";
import { Ground } from "./Ground";
import { Hills } from "./Hills";
import { Lighting } from "./Lighting";
import { PATH_WIDTH, type MeadowLayout } from "./layout";
import { PathRibbon } from "./PathRibbon";
import { Rocks } from "./Rocks";
import { SkyDome } from "./SkyDome";
import { Trees } from "./Trees";

export interface MeadowSceneProps {
  layout: MeadowLayout;
  quality: QualitySettings;
  reducedMotion: boolean;
}

/** Composes the first meadow from pure layout data. */
export function MeadowScene({ layout, quality, reducedMotion }: MeadowSceneProps) {
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
      <FernPlaceholder
        position={layout.fernSpawn}
        yaw={layout.fernSpawnYaw}
        animation="idle"
        reducedMotion={reducedMotion}
      />
    </>
  );
}
