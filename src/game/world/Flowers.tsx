"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { writeInstances } from "./instancing";
import type { FlowerPlacement } from "./layout";
import { getSharedMaterials } from "./materials";

export interface FlowersProps {
  flowers: readonly FlowerPlacement[];
  colors: readonly string[];
}

/** Unscaled stem height; the blossom sits on top of it. */
export const FLOWER_STEM_HEIGHT = 0.28;
const DAISY_PETALS = 6;

/**
 * Builds petal geometry from triangles, adding the reverse of every triangle
 * so petals show from both sides without a double-sided material, and giving
 * every vertex an upward normal so each petal is lit like the ground rather
 * than going grey when it faces away from the sun (stylised-foliage trick).
 */
function petalGeometry(positions: number[]): THREE.BufferGeometry {
  const both: number[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const tri = positions.slice(i, i + 9);
    both.push(...tri, ...tri.slice(6, 9), ...tri.slice(3, 6), ...tri.slice(0, 3));
  }
  const normals = new Float32Array(both.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(both, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Six low-poly petals around the stem, lying almost flat and cupping up a
 * little at the tips. Built once and shared by every daisy instance.
 */
function daisyGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < DAISY_PETALS; i += 1) {
    const angle = (i / DAISY_PETALS) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = -dz;
    const pz = dx;
    const base = [dx * 0.025, 0.0, dz * 0.025];
    const left = [dx * 0.09 + px * 0.04, 0.012, dz * 0.09 + pz * 0.04];
    const right = [dx * 0.09 - px * 0.04, 0.012, dz * 0.09 - pz * 0.04];
    const tip = [dx * 0.15, 0.04, dz * 0.15];
    positions.push(...base, ...right, ...left, ...right, ...tip, ...left);
  }
  return petalGeometry(positions);
}

/**
 * Tulip / bell shape: five petals rising steeply from the stem so the colour
 * shows from the side as well as from above (a plain cone read as a grey lump).
 */
function bellGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const petals = 5;
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const px = -dz;
    const pz = dx;
    const base = [dx * 0.02, 0.0, dz * 0.02];
    const left = [dx * 0.07 + px * 0.05, 0.07, dz * 0.07 + pz * 0.05];
    const right = [dx * 0.07 - px * 0.05, 0.07, dz * 0.07 - pz * 0.05];
    const tip = [dx * 0.085, 0.15, dz * 0.085];
    positions.push(...base, ...right, ...left, ...right, ...tip, ...left);
  }
  return petalGeometry(positions);
}

/**
 * Meadow flowers: petal blossoms (daisies) or cups (bells) on thin, slightly
 * leaning stems with one leaf each. Everything is instanced; five draw calls
 * for the whole meadow.
 */
export function Flowers({ flowers, colors }: FlowersProps) {
  const daisies = useMemo(() => flowers.filter((f) => f.kind === "daisy"), [flowers]);
  const bells = useMemo(() => flowers.filter((f) => f.kind === "bell"), [flowers]);
  const daisyGeo = useMemo(() => daisyGeometry(), []);
  const bellGeo = useMemo(() => bellGeometry(), []);
  const daisyMesh = useRef<THREE.InstancedMesh>(null);
  const centreMesh = useRef<THREE.InstancedMesh>(null);
  const bellMesh = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  const materials = getSharedMaterials();

  useLayoutEffect(() => {
    // Top of a stem of height h after leaning by `tilt` (about Z) and turning by `rotationY`.
    const stemTop = (f: FlowerPlacement, h: number): [number, number, number] => [
      -h * Math.sin(f.tilt) * Math.cos(f.rotationY),
      h * Math.cos(f.tilt),
      h * Math.sin(f.tilt) * Math.sin(f.rotationY),
    ];
    const tinted = (out: THREE.Color, f: FlowerPlacement) => {
      out.set(colors[f.colorIndex] ?? colors[0] ?? "#ff6f91");
      out.offsetHSL(f.tint * 0.04, 0, f.tint * 0.35);
    };
    const blossom = (f: FlowerPlacement, out: { position: THREE.Vector3; euler: THREE.Euler; scale: THREE.Vector3; color: THREE.Color }) => {
      const top = stemTop(f, FLOWER_STEM_HEIGHT * f.scale);
      out.position.set(f.position[0] + top[0], top[1], f.position[2] + top[2]);
      out.euler.set(0, f.rotationY, f.tilt);
      out.scale.setScalar(f.scale);
      tinted(out.color, f);
    };
    if (daisyMesh.current) writeInstances(daisyMesh.current, daisies, (f, _i, out) => blossom(f, out));
    if (centreMesh.current) {
      writeInstances(centreMesh.current, daisies, (f, _i, out) => {
        blossom(f, out);
        out.scale.setScalar(f.scale);
        // Yellow heart on pale petals, a darker heart on strong colours.
        const petal = new THREE.Color(colors[f.colorIndex] ?? "#ffffff");
        const light = petal.r + petal.g + petal.b > 2.4;
        out.color.set(light ? "#ffd84a" : "#7a4a12");
      });
    }
    if (bellMesh.current) writeInstances(bellMesh.current, bells, (f, _i, out) => blossom(f, out));
    if (stems.current) {
      writeInstances(stems.current, flowers, (f, _i, out) => {
        const top = stemTop(f, FLOWER_STEM_HEIGHT * f.scale);
        out.position.set(f.position[0] + top[0] / 2, top[1] / 2, f.position[2] + top[2] / 2);
        out.euler.set(0, f.rotationY, f.tilt);
        out.scale.set(1, f.scale, 1);
        out.color.set("#ffffff").offsetHSL(0, 0, f.tint * 0.2);
      });
    }
    if (leaves.current) {
      writeInstances(leaves.current, flowers, (f, _i, out) => {
        const top = stemTop(f, FLOWER_STEM_HEIGHT * f.scale);
        const side = f.rotationY + 1.3;
        out.position.set(
          f.position[0] + top[0] * 0.35 + Math.cos(side) * 0.05 * f.scale,
          top[1] * 0.35,
          f.position[2] + top[2] * 0.35 - Math.sin(side) * 0.05 * f.scale,
        );
        out.euler.set(0, side, 0.55);
        out.scale.set(1.7 * f.scale, 0.22 * f.scale, 0.8 * f.scale);
        out.color.set("#ffffff").offsetHSL(0, 0, f.tint * 0.3);
      });
    }
  }, [flowers, daisies, bells, colors]);

  return (
    <group>
      {daisies.length > 0 ? (
        <>
          <instancedMesh ref={daisyMesh} args={[daisyGeo, materials.flower, daisies.length]} />
          <instancedMesh ref={centreMesh} args={[undefined, materials.flowerCentre, daisies.length]}>
            <sphereGeometry args={[0.035, 6, 4]} />
          </instancedMesh>
        </>
      ) : null}
      {bells.length > 0 ? <instancedMesh ref={bellMesh} args={[bellGeo, materials.flower, bells.length]} /> : null}
      <instancedMesh ref={stems} args={[undefined, materials.stem, flowers.length]}>
        <cylinderGeometry args={[0.014, 0.022, FLOWER_STEM_HEIGHT, 5]} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, materials.leaf, flowers.length]}>
        <sphereGeometry args={[0.06, 5, 4]} />
      </instancedMesh>
    </group>
  );
}
