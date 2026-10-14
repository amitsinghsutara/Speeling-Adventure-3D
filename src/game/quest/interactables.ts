import { distanceXZ, type Vec3 } from "@/game/world/vec";

/** Typed world interactable (data-contracts.md), extended with the quest it starts. */
export interface WorldInteractable {
  readonly id: string;
  readonly kind: "spelling-sign" | "collectible" | "landmark";
  readonly promptKey: string;
  readonly position: Vec3;
  readonly interactionRadius: number;
  readonly questId?: string;
}

/** Nearest interactable whose radius contains the position, or null. */
export function findInteractableInRange(
  position: Vec3,
  interactables: readonly WorldInteractable[],
): WorldInteractable | null {
  let best: WorldInteractable | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of interactables) {
    const distance = distanceXZ(position, item.position);
    if (distance <= item.interactionRadius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}
