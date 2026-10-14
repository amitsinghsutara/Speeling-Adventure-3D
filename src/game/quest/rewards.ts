/**
 * Game rewards are cosmetic progression (stars). They are granted by the
 * quest layer and never read or written by the learning layer, so a star can
 * never imply mastery (constitution §2, FR-07). A quest can earn up to three
 * stars; each star has its own id so a better replay adds stars and a worse
 * one never removes any (the source project's "best stars" rule).
 */
export interface GameRewards {
  readonly stars: number;
  readonly collectedRewardIds: readonly string[];
}

export const EMPTY_REWARDS: GameRewards = { stars: 0, collectedRewardIds: [] };

export function starRewardId(questId: string, star: number): string {
  return `star:${questId}#${star}`;
}

/** Stars collected per quest, derived from the reward ids. */
export function starsByQuest(collectedRewardIds: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of collectedRewardIds) {
    const match = /^star:(.+)#\d+$/.exec(id);
    if (!match || !match[1]) continue;
    result.set(match[1], (result.get(match[1]) ?? 0) + 1);
  }
  return result;
}

/** Grants a reward once; repeated grants of the same id are no-ops. */
export function grantReward(
  rewards: GameRewards,
  rewardId: string,
): { rewards: GameRewards; granted: boolean } {
  if (rewards.collectedRewardIds.includes(rewardId)) {
    return { rewards, granted: false };
  }
  return {
    granted: true,
    rewards: {
      stars: rewards.stars + 1,
      collectedRewardIds: [...rewards.collectedRewardIds, rewardId],
    },
  };
}
