import type { WorldInteractable } from "@/game/quest/interactables";
import { sampleCatmullRom } from "./curve";
import { createRandom, randomBetween } from "./random";
import { sceneForLevel, type SceneDefinition, type ScenePalette } from "./scenes";
import { distanceToPolylineXZ, distanceXZ, type Vec3 } from "./vec";

/** Radius of the explorable area. Trees and flowers stay inside it. */
export const MEADOW_RADIUS = 50;
/** Radius of the ground disc; extends under the hills so no edge is visible. */
export const GROUND_RADIUS = 130;
export const PATH_WIDTH = 2.6;
/** Minimum distance from the path centreline to any tree trunk. */
export const PATH_CLEARANCE = 3.4;
export const TREE_SPACING = 2.6;
/** The dense tree belt that encloses the meadow, outside the playable edge. */
export const FOREST_INNER_RADIUS = MEADOW_RADIUS - 2;
export const FOREST_OUTER_RADIUS = 68;
export const FOREST_SPACING = 1.9;
export const BUSH_SPACING = 1.4;
export const SPAWN_CLEARANCE = 4.5;
export const SIGN_CLEARANCE = 3;
export const DEFAULT_SEED = 20261014;
/** Puzzles (signs) per scene; matches `PUZZLES_PER_LEVEL` in the learning layer. */
export const SIGNS_PER_SCENE = 5;

/**
 * Path network: the main path runs south → north and ends at the exit gate;
 * four branches lead to signs, the fifth sign stands beside the main path.
 * Control points are hand-authored so the layout reads well from the camera.
 */
const MAIN_PATH_CONTROL: readonly Vec3[] = [
  [0, 0, 36],
  [1.5, 0, 26],
  [-3, 0, 16],
  [-1, 0, 6],
  [3.5, 0, -4],
  [1, 0, -14],
  [-2, 0, -24],
  [2, 0, -34],
  [0, 0, -44],
];

const BRANCH_CONTROLS: readonly (readonly Vec3[])[] = [
  // West
  [[-1, 0, 6], [-8, 0, 3], [-16, 0, 1], [-24, 0, -3], [-31, 0, -8]],
  // East
  [[3.5, 0, -4], [11, 0, -2], [19, 0, -4], [27, 0, -1], [34, 0, 3]],
  // South-east
  [[1.5, 0, 26], [9, 0, 29], [17, 0, 33], [25, 0, 31]],
  // North-west
  [[-2, 0, -24], [-9, 0, -27], [-17, 0, -25], [-25, 0, -29]],
];

/** Sign positions: beside each branch end, plus one by the main path. */
const SIGN_POSITIONS: readonly Vec3[] = [
  [3.1, 0, 21.5],
  [-33, 0, -10.5],
  [36, 0, 5.5],
  [27.5, 0, 33.5],
  [-27.5, 0, -31.5],
];

const EXIT_GATE: Vec3 = [0, 0, -47];
/** Behind the camera start position, so it is seen only when turning round. */
const ENTRY_GATE: Vec3 = [0, 0, 44];

export type TreeKind = "conifer" | "round";

export interface TreePlacement {
  readonly position: Vec3;
  readonly kind: TreeKind;
  readonly trunkHeight: number;
  /** Canopy radius for round trees; tier scale for conifers. */
  readonly canopyRadius: number;
  readonly colorIndex: number;
  readonly rotationY: number;
  /** Small random lean (radians) so rows never look planted. */
  readonly leanX: number;
  readonly leanZ: number;
  /** True for trees in the enclosing belt (outside the playable area). */
  readonly inForestBelt: boolean;
}

export interface GrassPlacement {
  readonly position: Vec3;
  readonly scale: number;
  readonly colorIndex: number;
  readonly rotationY: number;
}

export interface BushPlacement {
  readonly position: Vec3;
  readonly scale: number;
  readonly colorIndex: number;
  readonly rotationY: number;
}

export interface HillPlacement {
  readonly position: Vec3;
  readonly radiusX: number;
  readonly height: number;
  readonly radiusZ: number;
  readonly colorIndex: number;
}

export interface RockPlacement {
  readonly position: Vec3;
  readonly scale: number;
  readonly rotationY: number;
}

export interface FlowerPlacement {
  readonly position: Vec3;
  readonly colorIndex: number;
  readonly scale: number;
}

export interface CloudPlacement {
  readonly position: Vec3;
  readonly scale: number;
}

export interface MeadowLayout {
  readonly seed: number;
  readonly scene: SceneDefinition;
  readonly palette: ScenePalette;
  /** Signposts and gates Fern can interact with. */
  readonly interactables: readonly WorldInteractable[];
  /** Every path; `paths[0]` is the main path. */
  readonly paths: readonly (readonly Vec3[])[];
  readonly mainPath: readonly Vec3[];
  readonly trees: readonly TreePlacement[];
  readonly bushes: readonly BushPlacement[];
  readonly grass: readonly GrassPlacement[];
  readonly hills: readonly HillPlacement[];
  readonly rocks: readonly RockPlacement[];
  readonly flowers: readonly FlowerPlacement[];
  readonly clouds: readonly CloudPlacement[];
  readonly fernSpawn: Vec3;
  /** Yaw (radians about Y) Fern faces on spawn; 0 looks down −Z. */
  readonly fernSpawnYaw: number;
  readonly cameraStart: Vec3;
  readonly cameraTarget: Vec3;
}

export interface MeadowLayoutOptions {
  /** Which level's scene to build; decides palette, seed and puzzle ids. */
  readonly level?: number;
  readonly seed?: number;
  /** Trees inside the meadow (around the paths). */
  readonly treeCount: number;
  /** Trees in the dense belt around the meadow edge. */
  readonly forestTreeCount: number;
  readonly bushCount: number;
  /** Grass tufts scattered over the meadow (instanced, chunked for culling). */
  readonly grassCount: number;
  readonly flowerCount: number;
  readonly rockCount: number;
  readonly cloudCount: number;
}

/** Interactables for a scene: five puzzle signs, an exit gate and (from level 2) an entry gate. */
export function sceneInteractables(level: number): WorldInteractable[] {
  const items: WorldInteractable[] = SIGN_POSITIONS.map((position, i) => ({
    id: `sign-level-${level}-${i + 1}`,
    kind: "spelling-sign",
    promptKey: "prompt.sign.read",
    position,
    interactionRadius: 2.6,
    questId: `level-${level}/puzzle-${i + 1}`,
  }));
  items.push({
    id: `gate-level-${level}-exit`,
    kind: "landmark",
    promptKey: "prompt.gate.next",
    position: EXIT_GATE,
    interactionRadius: 3.2,
    travelToLevel: level + 1,
  });
  if (level > 1) {
    items.push({
      id: `gate-level-${level}-entry`,
      kind: "landmark",
      promptKey: "prompt.gate.back",
      position: ENTRY_GATE,
      interactionRadius: 3.2,
      travelToLevel: level - 1,
    });
  }
  return items;
}

/**
 * Deterministically lays out a scene. Everything is pure data so the rules
 * (path clearance, spacing, bounds) can be unit-tested without Three.js.
 */
export function generateMeadowLayout(options: MeadowLayoutOptions): MeadowLayout {
  const scene = sceneForLevel(options.level ?? 1);
  const palette = scene.palette;
  const seed = options.seed ?? scene.seed;
  const next = createRandom(seed);

  const mainPath = sampleCatmullRom(MAIN_PATH_CONTROL, 8);
  const branches = BRANCH_CONTROLS.map((control) => sampleCatmullRom(control, 8));
  const paths = [mainPath, ...branches];

  const fernSpawn: Vec3 = [1, 0, 30];
  const fernSpawnYaw = 0;
  const cameraStart: Vec3 = [0.6, 4.4, 38];
  const cameraTarget: Vec3 = [1, 1, 29];
  const interactables = sceneInteractables(scene.level);

  const pathDistance = (p: Vec3): number =>
    Math.min(...paths.map((line) => distanceToPolylineXZ(p, line)));
  const nearInteractable = (p: Vec3, clearance: number): boolean =>
    interactables.some((i) => distanceXZ(i.position, p) < clearance);

  const randomPointInDisc = (radius: number, minRadius = 0): Vec3 => {
    const r = Math.sqrt(randomBetween(next, minRadius * minRadius, radius * radius));
    const angle = randomBetween(next, 0, Math.PI * 2);
    return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
  };

  // ---- Trees -------------------------------------------------------------
  const trees: TreePlacement[] = [];
  const makeTree = (position: Vec3, inForestBelt: boolean): TreePlacement => {
    const kind: TreeKind = next() < (inForestBelt ? 0.9 : 0.75) ? "conifer" : "round";
    const size = inForestBelt ? randomBetween(next, 1.0, 1.6) : randomBetween(next, 0.85, 1.35);
    return {
      position,
      kind,
      trunkHeight: kind === "conifer" ? randomBetween(next, 0.9, 1.4) * size : randomBetween(next, 1.1, 1.8),
      canopyRadius: kind === "conifer" ? size : randomBetween(next, 1.2, 1.9),
      colorIndex: Math.floor(next() * (kind === "conifer" ? palette.conifer.length : palette.canopy.length)),
      rotationY: randomBetween(next, 0, Math.PI * 2),
      leanX: randomBetween(next, -0.05, 0.05),
      leanZ: randomBetween(next, -0.05, 0.05),
      inForestBelt,
    };
  };
  const maxTreeAttempts = options.treeCount * 60;
  for (let attempt = 0; attempt < maxTreeAttempts && trees.length < options.treeCount; attempt += 1) {
    const position = randomPointInDisc(MEADOW_RADIUS - 2, 6);
    if (pathDistance(position) < PATH_CLEARANCE) continue;
    if (distanceXZ(position, fernSpawn) < SPAWN_CLEARANCE) continue;
    if (nearInteractable(position, SIGN_CLEARANCE)) continue;
    if (trees.some((t) => distanceXZ(t.position, position) < TREE_SPACING)) continue;
    trees.push(makeTree(position, false));
  }
  const beltTrees: TreePlacement[] = [];
  const maxBeltAttempts = options.forestTreeCount * 40;
  for (let attempt = 0; attempt < maxBeltAttempts && beltTrees.length < options.forestTreeCount; attempt += 1) {
    const position = randomPointInDisc(FOREST_OUTER_RADIUS, FOREST_INNER_RADIUS);
    if (pathDistance(position) < PATH_CLEARANCE) continue;
    if (nearInteractable(position, SIGN_CLEARANCE)) continue;
    if (beltTrees.some((t) => distanceXZ(t.position, position) < FOREST_SPACING)) continue;
    if (trees.some((t) => distanceXZ(t.position, position) < FOREST_SPACING)) continue;
    beltTrees.push(makeTree(position, true));
  }
  trees.push(...beltTrees);

  // ---- Bushes ------------------------------------------------------------
  const bushes: BushPlacement[] = [];
  const maxBushAttempts = options.bushCount * 40;
  for (let attempt = 0; attempt < maxBushAttempts && bushes.length < options.bushCount; attempt += 1) {
    const position = randomPointInDisc(FOREST_INNER_RADIUS + 4, 5);
    if (pathDistance(position) < PATH_WIDTH / 2 + 1.2) continue;
    if (distanceXZ(position, fernSpawn) < SPAWN_CLEARANCE) continue;
    if (nearInteractable(position, 2)) continue;
    if (trees.some((t) => distanceXZ(t.position, position) < 1.1)) continue;
    if (bushes.some((b) => distanceXZ(b.position, position) < BUSH_SPACING)) continue;
    const nearTree = trees.some((t) => distanceXZ(t.position, position) < 4);
    const nearEdge = Math.hypot(position[0], position[2]) > MEADOW_RADIUS - 8;
    if (!nearTree && !nearEdge && next() < 0.7) continue;
    bushes.push({
      position,
      scale: randomBetween(next, 0.5, 1.0),
      colorIndex: Math.floor(next() * palette.bush.length),
      rotationY: randomBetween(next, 0, Math.PI * 2),
    });
  }

  // ---- Grass -------------------------------------------------------------
  const grass: GrassPlacement[] = [];
  const grassClearance = PATH_WIDTH / 2 + 0.25;
  const maxGrassAttempts = options.grassCount * 4;
  for (let attempt = 0; attempt < maxGrassAttempts && grass.length < options.grassCount; attempt += 1) {
    const position = randomPointInDisc(FOREST_INNER_RADIUS + 6);
    if (pathDistance(position) < grassClearance) continue;
    grass.push({
      position,
      scale: randomBetween(next, 0.65, 1.15),
      colorIndex: Math.floor(next() * palette.grass.length),
      rotationY: randomBetween(next, 0, Math.PI * 2),
    });
  }

  // ---- Hills (two rings beyond the tree belt) ----------------------------
  const hills: HillPlacement[] = [];
  const nearCount = 16;
  for (let i = 0; i < nearCount; i += 1) {
    const angle = (i / nearCount) * Math.PI * 2 + randomBetween(next, -0.15, 0.15);
    const r = randomBetween(next, 62, 76);
    hills.push({
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
      radiusX: randomBetween(next, 12, 20),
      height: randomBetween(next, 5, 10),
      radiusZ: randomBetween(next, 10, 17),
      colorIndex: Math.floor(next() * palette.hill.length),
    });
  }
  const farCount = 10;
  for (let i = 0; i < farCount; i += 1) {
    const angle = (i / farCount) * Math.PI * 2 + randomBetween(next, -0.2, 0.2);
    const r = randomBetween(next, 88, 108);
    hills.push({
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
      radiusX: randomBetween(next, 22, 34),
      height: randomBetween(next, 11, 18),
      radiusZ: randomBetween(next, 18, 28),
      colorIndex: Math.floor(next() * palette.hill.length),
    });
  }

  // ---- Rocks -------------------------------------------------------------
  const rocks: RockPlacement[] = [];
  const maxRockAttempts = options.rockCount * 40;
  for (let attempt = 0; attempt < maxRockAttempts && rocks.length < options.rockCount; attempt += 1) {
    const position = randomPointInDisc(MEADOW_RADIUS - 4, 5);
    if (pathDistance(position) < 2.2) continue;
    if (bushes.some((b) => distanceXZ(b.position, position) < 1.2)) continue;
    if (distanceXZ(position, fernSpawn) < SPAWN_CLEARANCE) continue;
    if (nearInteractable(position, 2.5)) continue;
    if (trees.some((t) => distanceXZ(t.position, position) < 1.8)) continue;
    rocks.push({
      position,
      scale: randomBetween(next, 0.5, 1.2),
      rotationY: randomBetween(next, 0, Math.PI * 2),
    });
  }

  // ---- Flowers -----------------------------------------------------------
  const flowers: FlowerPlacement[] = [];
  const maxFlowerAttempts = options.flowerCount * 20;
  for (let attempt = 0; attempt < maxFlowerAttempts && flowers.length < options.flowerCount; attempt += 1) {
    const position = randomPointInDisc(MEADOW_RADIUS - 6);
    if (pathDistance(position) < PATH_WIDTH / 2 + 0.5) continue;
    if (distanceXZ(position, fernSpawn) < 1.5) continue;
    if (nearInteractable(position, 1)) continue;
    flowers.push({
      position,
      colorIndex: Math.floor(next() * palette.flower.length),
      scale: randomBetween(next, 0.8, 1.3),
    });
  }

  // ---- Clouds ------------------------------------------------------------
  const clouds: CloudPlacement[] = [];
  for (let i = 0; i < options.cloudCount; i += 1) {
    const angle = (i / Math.max(1, options.cloudCount)) * Math.PI * 2 + randomBetween(next, -0.3, 0.3);
    const r = randomBetween(next, 30, 95);
    clouds.push({
      position: [Math.cos(angle) * r, randomBetween(next, 30, 46), Math.sin(angle) * r],
      scale: randomBetween(next, 3, 6),
    });
  }

  return {
    seed,
    scene,
    palette,
    interactables,
    paths,
    mainPath,
    trees,
    bushes,
    grass,
    hills,
    rocks,
    flowers,
    clouds,
    fernSpawn,
    fernSpawnYaw,
    cameraStart,
    cameraTarget,
  };
}
