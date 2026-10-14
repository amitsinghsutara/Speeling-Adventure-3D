import * as THREE from "three";
import { applyWind, createWindUniforms, type WindUniforms } from "./wind";

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
  readonly conifer: THREE.MeshLambertMaterial;
  readonly bush: THREE.MeshLambertMaterial;
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
  /** Shared wind clock used by the swaying materials. */
  readonly wind: WindUniforms;
}

let cache: SharedMaterials | null = null;

export function getSharedMaterials(): SharedMaterials {
  if (cache) return cache;
  const wind = createWindUniforms();
  cache = {
    wind,
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
    conifer: new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }),
    bush: new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true }),
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
  // Wind sway (vertex shader). Local-space ranges match each geometry:
  // canopy sphere r=1, trunk cylinder h=1, blossom sphere r=0.15, stem h=0.32.
  applyWind(cache.canopy, wind, { baseY: -1, spanY: 2, amplitude: 0.14 });
  applyWind(cache.trunk, wind, { baseY: -0.5, spanY: 1, amplitude: 0.03 });
  // Cone tier: unit cone, height 1 centred at 0.
  applyWind(cache.conifer, wind, { baseY: -0.5, spanY: 1, amplitude: 0.08 });
  applyWind(cache.bush, wind, { baseY: -0.6, spanY: 1.2, amplitude: 0.04 });
  applyWind(cache.flower, wind, { baseY: -0.15, spanY: 0.3, amplitude: 0.08 });
  applyWind(cache.stem, wind, { baseY: -0.16, spanY: 0.32, amplitude: 0.08 });
  return cache;
}
