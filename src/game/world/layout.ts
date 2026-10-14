import { sampleCatmullRom } from "./curve";
import { createRandom, randomBetween } from "./random";
import { distanceToPolylineXZ, distanceXZ, type Vec3 } from "./vec";

/** Radius of the explorable meadow. Trees and flowers stay inside it. */
export const MEADOW_RADIUS = 34;
/** Radius of the ground disc; extends under the hills so no edge is visible. */
export const GROUND_RADIUS = 90;
export const PATH_WIDTH = 2.6;
/** Minimum distance from the path centreline to any tree trunk. */
export const PATH_CLEARANCE = 3.4;
export const TREE_SPACING = 2.6;
export const SPAWN_CLEARANCE = 4.5;
export const DEFAULT_SEED = 20261014;

const MAIN_PATH_CONTROL: readonly Vec3[] = [
  [0, 0, 24],
  [1.5, 0, 15],
  [-3, 0, 7],
  [-1, 0, -1],
  [3.5, 0, -9],
  [1, 0, -17],
  [-2, 0, -26],
];

const BRANCH_PATH_CONTROL: readonly Vec3[] = [
  [-1, 0, -1],
  [-7, 0, -4],
  [-14, 0, -5],
  [-21, 0, -9],
];

export interface TreePlacement {
  readonly position: Vec3;
  readonly trunkHeight: number;
  readonly canopyRadius: number;
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
  readonly mainPath: readonly Vec3[];
  readonly branchPath: readonly Vec3[];
  readonly trees: readonly TreePlacement[];
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
  readonly seed?: number;
  readonly treeCount: number;
  readonly flowerCount: number;
  readonly rockCount: number;
  readonly cloudCount: number;
}

export const HILL_COLORS = ["#5cbf4f", "#67c95a", "#52b347", "#74d166"] as const;
export const CANOPY_COLORS = ["#4fb848", "#5fc957", "#3fa63c", "#79d46c"] as const;
export const FLOWER_COLORS = [
  "#ff6f91",
  "#ffd23f",
  "#ffffff",
  "#b388ff",
  "#ff8c42",
] as const;

/**
 * Deterministically lays out the first meadow. Everything is pure data so the
 * rules (path clearance, spacing, bounds) can be unit-tested without Three.js.
 */
export function generateMeadowLayout(
  options: MeadowLayoutOptions,
): MeadowLayout {
  const seed = options.seed ?? DEFAULT_SEED;
  const next = createRandom(seed);

  const mainPath = sampleCatmullRom(MAIN_PATH_CONTROL, 8);
  const branchPath = sampleCatmullRom(BRANCH_PATH_CONTROL, 8);
  const paths = [mainPath, branchPath];

  const fernSpawn: Vec3 = [0, 0, 21];
  const fernSpawnYaw = 0;
  const cameraStart: Vec3 = [0, 4.4, 29];
  const cameraTarget: Vec3 = [0, 1, 20];

  const pathDistance = (p: Vec3): number =>
    Math.min(...paths.map((line) => distanceToPolylineXZ(p, line)));

  const randomPointInDisc = (radius: number, minRadius = 0): Vec3 => {
    // Uniform in area between minRadius and radius.
    const r = Math.sqrt(
      randomBetween(next, minRadius * minRadius, radius * radius),
    );
    const angle = randomBetween(next, 0, Math.PI * 2);
    return [Math.cos(angle) * r, 0, Math.sin(angle) * r];
  };

  // ---- Trees -------------------------------------------------------------
  const trees: TreePlacement[] = [];
  const maxTreeAttempts = options.treeCount * 60;
  for (
    let attempt = 0;
    attempt < maxTreeAttempts && trees.length < options.treeCount;
    attempt += 1
  ) {
    const position = randomPointInDisc(MEADOW_RADIUS - 2, 6);
    if (pathDistance(position) < PATH_CLEARANCE) continue;
    if (distanceXZ(position, fernSpawn) < SPAWN_CLEARANCE) continue;
    if (trees.some((t) => distanceXZ(t.position, position) < TREE_SPACING)) {
      continue;
    }
    trees.push({
      position,
      trunkHeight: randomBetween(next, 1.1, 1.8),
      canopyRadius: randomBetween(next, 1.2, 1.9),
      colorIndex: Math.floor(next() * CANOPY_COLORS.length),
      rotationY: randomBetween(next, 0, Math.PI * 2),
    });
  }

  // ---- Hills (two rings beyond the tree line) ----------------------------
  const hills: HillPlacement[] = [];
  const nearCount = 14;
  for (let i = 0; i < nearCount; i += 1) {
    const angle =
      (i / nearCount) * Math.PI * 2 + randomBetween(next, -0.15, 0.15);
    const r = randomBetween(next, 40, 52);
    hills.push({
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
      radiusX: randomBetween(next, 10, 17),
      height: randomBetween(next, 4.5, 9),
      radiusZ: randomBetween(next, 9, 15),
      colorIndex: Math.floor(next() * HILL_COLORS.length),
    });
  }
  const farCount = 9;
  for (let i = 0; i < farCount; i += 1) {
    const angle =
      (i / farCount) * Math.PI * 2 + randomBetween(next, -0.2, 0.2);
    const r = randomBetween(next, 62, 78);
    hills.push({
      position: [Math.cos(angle) * r, 0, Math.sin(angle) * r],
      radiusX: randomBetween(next, 18, 28),
      height: randomBetween(next, 9, 15),
      radiusZ: randomBetween(next, 16, 24),
      colorIndex: Math.floor(next() * HILL_COLORS.length),
    });
  }

  // ---- Rocks -------------------------------------------------------------
  const rocks: RockPlacement[] = [];
  const maxRockAttempts = options.rockCount * 40;
  for (
    let attempt = 0;
    attempt < maxRockAttempts && rocks.length < options.rockCount;
    attempt += 1
  ) {
    const position = randomPointInDisc(MEADOW_RADIUS - 4, 5);
    if (pathDistance(position) < 2.2) continue;
    if (distanceXZ(position, fernSpawn) < SPAWN_CLEARANCE) continue;
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
  for (
    let attempt = 0;
    attempt < maxFlowerAttempts && flowers.length < options.flowerCount;
    attempt += 1
  ) {
    const position = randomPointInDisc(MEADOW_RADIUS - 6);
    if (pathDistance(position) < PATH_WIDTH / 2 + 0.5) continue;
    if (distanceXZ(position, fernSpawn) < 1.5) continue;
    flowers.push({
      position,
      colorIndex: Math.floor(next() * FLOWER_COLORS.length),
      scale: randomBetween(next, 0.8, 1.3),
    });
  }

  // ---- Clouds ------------------------------------------------------------
  const clouds: CloudPlacement[] = [];
  for (let i = 0; i < options.cloudCount; i += 1) {
    const angle =
      (i / Math.max(1, options.cloudCount)) * Math.PI * 2 +
      randomBetween(next, -0.3, 0.3);
    const r = randomBetween(next, 25, 70);
    clouds.push({
      position: [
        Math.cos(angle) * r,
        randomBetween(next, 26, 40),
        Math.sin(angle) * r,
      ],
      scale: randomBetween(next, 2.5, 5),
    });
  }

  return {
    seed,
    mainPath,
    branchPath,
    trees,
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
