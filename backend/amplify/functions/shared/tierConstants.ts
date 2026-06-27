export const PLAN_TIERS = {
    FREE: 'free',
    BASIC: 'basic',
    PROFESSIONAL: 'professional',
    ENTERPRISE: 'enterprise'
} as const;

export type PlanTier = (typeof PLAN_TIERS)[keyof typeof PLAN_TIERS];

export function stripePriceToTier(tierMetadata: string | null | undefined): PlanTier {
    // Support legacy Stripe metadata aliases while keeping the current public
    // WanderAware tiers as Starter, Professional, and Enterprise.
    if (tierMetadata === 'basic' || tierMetadata === 'developer') return PLAN_TIERS.BASIC;
    if (tierMetadata === 'professional' || tierMetadata === 'starter') return PLAN_TIERS.PROFESSIONAL;
    if (tierMetadata === 'enterprise' || tierMetadata === 'growth') return PLAN_TIERS.ENTERPRISE;
    throw new Error(`Unsupported Stripe tier metadata: ${tierMetadata}`);
}

// Per-tier device capacity limits.
// maxDevices is the org-wide capacity field used by billing/admin flows.
// maxDevicesPerUser limits how many web/client devices one user can keep active.
export const TIER_LIMITS = {
    free: { maxDevices: 1, maxDevicesPerUser: 2 },
    basic: { maxDevices: 1, maxDevicesPerUser: 2 },
    professional: { maxDevices: 5, maxDevicesPerUser: 2 },
    enterprise: { maxDevices: 999, maxDevicesPerUser: 3 }
} as const;

export function tierToLimits(tier: PlanTier) {
    return TIER_LIMITS[tier];
}

// Marketing display names - keep in sync with frontend/src/lib/plan-utils.ts.
export const TIER_DISPLAY_NAME: Record<PlanTier, string> = {
    free: 'Granted',
    basic: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
};

export function getTierDisplayName(tier: PlanTier): string {
    return TIER_DISPLAY_NAME[tier];
}
