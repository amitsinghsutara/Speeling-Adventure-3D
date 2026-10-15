/**
 * One scene per curriculum level. The same generator builds every scene;
 * the definition supplies the name, seed and colour palette so each level
 * feels like a new place without new assets.
 */
export interface ScenePalette {
  readonly ground: string;
  readonly path: string;
  readonly skyTop: string;
  readonly skyHorizon: string;
  readonly fog: string;
  readonly canopy: readonly string[];
  readonly conifer: readonly string[];
  readonly bush: readonly string[];
  readonly grass: readonly string[];
  readonly flower: readonly string[];
  readonly hill: readonly string[];
}

export interface SceneDefinition {
  readonly id: string;
  readonly level: number;
  readonly name: string;
  readonly seed: number;
  readonly palette: ScenePalette;
}

const SUNNY_MEADOW: ScenePalette = {
  ground: "#6fcf5f",
  path: "#dcb784",
  skyTop: "#4fa8ef",
  skyHorizon: "#d4f0ff",
  fog: "#cfeeff",
  canopy: ["#4fb848", "#5fc957", "#3fa63c", "#79d46c"],
  conifer: ["#2f7d3f", "#368a49", "#2a6f39", "#3f9552", "#2c7a44"],
  bush: ["#4aa848", "#5bb556", "#3e9a40"],
  grass: ["#63c457", "#70d063", "#58b94d", "#7bd86a", "#66c95a"],
  flower: ["#ff6f91", "#ffd23f", "#ffffff", "#b388ff", "#ff8c42"],
  hill: ["#5cbf4f", "#67c95a", "#52b347", "#74d166"],
};

const AUTUMN_WOODS: ScenePalette = {
  ground: "#9fbd4e",
  path: "#c9a06a",
  skyTop: "#5aa0e6",
  skyHorizon: "#ffe3c2",
  fog: "#f6dfc4",
  canopy: ["#e8862d", "#f2a53a", "#d9622a", "#f5c24b"],
  conifer: ["#3f7a3c", "#4b8a44", "#35693a", "#5a9450"],
  bush: ["#c27a2e", "#d6963a", "#a8651f"],
  grass: ["#a6c257", "#b2cc63", "#98b54c", "#c0d36e", "#aac35b"],
  flower: ["#ffffff", "#ffd23f", "#ff8c42", "#f25f5c", "#fff1a8"],
  hill: ["#a3b85a", "#b7a84a", "#8fae4e", "#c5a94d"],
};

const SNOWY_PINES: ScenePalette = {
  ground: "#eef5fb",
  path: "#cfd9e3",
  skyTop: "#7fb3e8",
  skyHorizon: "#eaf4ff",
  fog: "#e6f1fb",
  canopy: ["#5f9e72", "#6fae80", "#548f66", "#7cb98c"],
  conifer: ["#2d6b4a", "#356f52", "#245c40", "#3f7d5a", "#2f6a48"],
  bush: ["#8fb9a0", "#a3c7b1", "#7faa90"],
  grass: ["#dfe9ef", "#e8f0f5", "#d4e1ea", "#ecf3f8", "#dae6ee"],
  flower: ["#ffffff", "#bfe3ff", "#ffd6e0", "#e6e6ff", "#fff6c2"],
  hill: ["#e4edf5", "#d9e5ef", "#eef4fa", "#cfdce8"],
};

const BLUEBELL_GLADE: ScenePalette = {
  ground: "#62b76a",
  path: "#d7b47e",
  skyTop: "#6aa9f2",
  skyHorizon: "#e0ecff",
  fog: "#dbe8ff",
  canopy: ["#58b35a", "#6cc468", "#4aa14e", "#7fd07a"],
  conifer: ["#2e7446", "#357f4e", "#28673e", "#3c8a55"],
  bush: ["#56a85e", "#6ab86c", "#4a9a52"],
  grass: ["#6bc06f", "#7acb78", "#5fb465", "#86d383", "#70c472"],
  flower: ["#7b86ff", "#9aa3ff", "#5c6bff", "#ffffff", "#c4a6ff"],
  hill: ["#5db564", "#6cc072", "#52a85a", "#78c87d"],
};

const PALETTES: readonly { name: string; palette: ScenePalette }[] = [
  { name: "Sunny Meadow", palette: SUNNY_MEADOW },
  { name: "Autumn Woods", palette: AUTUMN_WOODS },
  { name: "Snowy Pines", palette: SNOWY_PINES },
  { name: "Bluebell Glade", palette: BLUEBELL_GLADE },
];

export const MAX_LEVEL = 10;

/** Scene for a level: palettes cycle, seeds differ, names stay readable. */
export function sceneForLevel(level: number): SceneDefinition {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const entry = PALETTES[(clamped - 1) % PALETTES.length] ?? PALETTES[0]!;
  const lap = Math.floor((clamped - 1) / PALETTES.length);
  return {
    id: `scene-level-${clamped}`,
    level: clamped,
    name: lap === 0 ? entry.name : `${entry.name} ${lap + 1}`,
    seed: 20261014 + clamped * 7919,
    palette: entry.palette,
  };
}
