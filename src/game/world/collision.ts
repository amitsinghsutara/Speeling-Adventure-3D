import { MEADOW_RADIUS, type MeadowLayout } from "./layout";

export interface CircleCollider {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface WorldColliders {
  /** Blocks the character's feet (trunks, rocks). */
  readonly walk: readonly CircleCollider[];
  /** Pulls the camera in (whole trees including canopies). */
  readonly camera: readonly CircleCollider[];
  /** Circular play boundary centred on the origin. */
  readonly boundsRadius: number;
}

export const TRUNK_COLLIDER_RADIUS = 0.5;
export const PLAYABLE_RADIUS = MEADOW_RADIUS - 1;

export function buildColliders(layout: MeadowLayout): WorldColliders {
  const walk: CircleCollider[] = [];
  const camera: CircleCollider[] = [];
  for (const tree of layout.trees) {
    // Belt trees sit outside the playable circle; skip them to keep per-frame checks small.
    if (tree.inForestBelt && Math.hypot(tree.position[0], tree.position[2]) > PLAYABLE_RADIUS + 1) continue;
    walk.push({
      x: tree.position[0],
      z: tree.position[2],
      radius: TRUNK_COLLIDER_RADIUS,
    });
    camera.push({
      x: tree.position[0],
      z: tree.position[2],
      radius: tree.canopyRadius,
    });
  }
  for (const bush of layout.bushes) {
    if (Math.hypot(bush.position[0], bush.position[2]) > PLAYABLE_RADIUS + 1) continue;
    walk.push({ x: bush.position[0], z: bush.position[2], radius: bush.scale * 0.7 });
  }
  for (const item of layout.interactables) {
    walk.push({ x: item.position[0], z: item.position[2], radius: 0.35 });
  }
  for (const rock of layout.rocks) {
    walk.push({
      x: rock.position[0],
      z: rock.position[2],
      radius: rock.scale * 0.85,
    });
  }
  return { walk, camera, boundsRadius: PLAYABLE_RADIUS };
}

/**
 * Pushes a circle of `radius` at (x, z) out of every overlapping collider and
 * back inside the circular boundary. Two passes keep corners between touching
 * obstacles stable. Pure; used both by the game loop and the tests.
 */
export function resolveCircleCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: readonly CircleCollider[],
  boundsRadius: number,
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const c of colliders) {
      const dx = px - c.x;
      const dz = pz - c.z;
      const minDistance = radius + c.radius;
      const distance = Math.hypot(dx, dz);
      if (distance >= minDistance) continue;
      if (distance === 0) {
        px = c.x + minDistance;
        continue;
      }
      const push = (minDistance - distance) / distance;
      px += dx * push;
      pz += dz * push;
    }
    const fromCentre = Math.hypot(px, pz);
    const maxFromCentre = boundsRadius - radius;
    if (fromCentre > maxFromCentre && fromCentre > 0) {
      px = (px / fromCentre) * maxFromCentre;
      pz = (pz / fromCentre) * maxFromCentre;
    }
  }
  return { x: px, z: pz };
}
