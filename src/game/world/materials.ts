import * as THREE from "three";

/**
 * Shared, lazily created materials. Every instanced mesh in the meadow reuses
 * these, which keeps shader compilations and draw-call state changes bounded.
 * Instanced meshes use a white base colour so per-instance colours show as-is.
 */
export interface SharedMaterials {
  readonly ground: THREE.MeshLambertMaterial;
  readonly path: THREE.MeshLambertMaterial;
  readonly hill: THREE.MeshLambertMaterial;
  readonly trunk: THREE.MeshLambertMaterial;
  readonly canopy: THREE.MeshLambertMaterial;
  readonly rock: THREE.MeshLambertMaterial;
  readonly flower: THREE.MeshLambertMaterial;
  readonly stem: THREE.MeshLambertMaterial;
  readonly cloud: THREE.MeshBasicMaterial;
  readonly signWood: THREE.MeshLambertMaterial;
  readonly signBoard: THREE.MeshLambertMaterial;
  readonly marker: THREE.MeshBasicMaterial;
  readonly markerActive: THREE.MeshBasicMaterial;
  readonly foxOrange: THREE.MeshLambertMaterial;
  readonly foxCream: THREE.MeshLambertMaterial;
  readonly foxDark: THREE.MeshLambertMaterial;
}

let cache: SharedMaterials | null = null;

export function getSharedMaterials(): SharedMaterials {
  if (cache) return cache;
  cache = {
    ground: new THREE.MeshLambertMaterial({ color: "#6fcf5f" }),
    path: new THREE.MeshLambertMaterial({
      color: "#dcb784",
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    hill: new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }),
    trunk: new THREE.MeshLambertMaterial({ color: "#8b5a2b", flatShading: true }),
    canopy: new THREE.MeshLambertMaterial({
      color: "#ffffff",
      flatShading: true,
    }),
    rock: new THREE.MeshLambertMaterial({ color: "#9aa3ad", flatShading: true }),
    flower: new THREE.MeshLambertMaterial({ color: "#ffffff" }),
    stem: new THREE.MeshLambertMaterial({ color: "#3f9c3a" }),
    cloud: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    signWood: new THREE.MeshLambertMaterial({ color: "#8a5a2b", flatShading: true }),
    signBoard: new THREE.MeshLambertMaterial({ color: "#c9893f", flatShading: true }),
    marker: new THREE.MeshBasicMaterial({ color: "#fff1a8" }),
    markerActive: new THREE.MeshBasicMaterial({ color: "#ffd23f" }),
    foxOrange: new THREE.MeshLambertMaterial({ color: "#f28c28" }),
    foxCream: new THREE.MeshLambertMaterial({ color: "#fff1d6" }),
    foxDark: new THREE.MeshLambertMaterial({ color: "#3b2a24" }),
  };
  return cache;
}
