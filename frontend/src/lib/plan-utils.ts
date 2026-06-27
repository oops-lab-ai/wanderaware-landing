export const TIER_RANK: Record<string, number> = {
  basic: 1,
  professional: 2,
  enterprise: 3,
};

export const TIER_DISPLAY_NAME: Record<string, string> = {
  free: "Granted",
  basic: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function getPlanDirection(currentTier: string, newTier: string): "upgrade" | "downgrade" | "same" {
  const currentRank = TIER_RANK[currentTier] ?? 0;
  const newRank = TIER_RANK[newTier] ?? 0;
  if (newRank > currentRank) return "upgrade";
  if (newRank < currentRank) return "downgrade";
  return "same";
}

export function getTierDisplayName(tier: string): string {
  return TIER_DISPLAY_NAME[tier] ?? tier;
}
