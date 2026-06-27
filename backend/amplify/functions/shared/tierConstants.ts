export const PLAN_TIERS = {
    FREE: 'free',
    BASIC: 'basic',
    PROFESSIONAL: 'professional',
    ENTERPRISE: 'enterprise'
} as const;
export type PlanTier = (typeof PLAN_TIERS)[keyof typeof PLAN_TIERS];

export function stripePriceToTier(tierMetadata: string | null | undefined): PlanTier {
    // Support both old (developer/starter/growth) and new (basic/professional/enterprise)
    // to handle existing Stripe prices during migration. The 'free' tier is NOT a
    // Stripe product — it's only granted via promo code redemption — so it never
    // appears in stripePriceToTier inputs.
    if (tierMetadata === 'basic' || tierMetadata === 'developer') return PLAN_TIERS.BASIC;
    if (tierMetadata === 'professional' || tierMetadata === 'starter') return PLAN_TIERS.PROFESSIONAL;
    if (tierMetadata === 'enterprise' || tierMetadata === 'growth') return PLAN_TIERS.ENTERPRISE;
    throw new Error(`Unsupported Stripe tier metadata: ${tierMetadata}`);
}

// Per-tier seat and per-user-device limits.
//   maxDevices         — total devices across the org (each unique (userId,deviceId) row counts as 1 seat)
//   maxDevicesPerUser — how many devices a single user can have active in the org at once
//
// The 'free' tier is hidden by default — it's only granted via Phase 4's promo code
// redemption flow. Hidden from the plan-cards grid, hidden from getProducts, hidden
// from marketing copy. User-facing name is "Granted", never "Free".
//
// Industry standard for science/care center web software (GraphPad Prism, Origin, Mnova,
// MestreNova, Spotfire): 2 devices per individual seat (laptop + workstation), 3 for
// enterprise (shared care center/teaching machines). These match the marketing copy in Stripe
// price `metadata.features` and docs/STRIPE_INTEGRATION.md.
export const TIER_LIMITS = {
    free: { maxDevices: 1, maxDevicesPerUser: 2 },
    basic: { maxDevices: 1, maxDevicesPerUser: 2 },
    professional: { maxDevices: 5, maxDevicesPerUser: 2 },
    enterprise: { maxDevices: 999, maxDevicesPerUser: 3 }
} as const;

export function tierToLimits(tier: PlanTier) {
    return TIER_LIMITS[tier];
}

// Marketing display names — keep in sync with frontend/src/lib/plan-utils.ts.
// Internal tier ids (basic/professional/enterprise) must NEVER appear in user-visible
// strings (toasts, emails, error messages). Always render via TIER_DISPLAY_NAME.
export const TIER_DISPLAY_NAME: Record<PlanTier, string> = {
    free: 'Granted',
    basic: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise'
};

export function getTierDisplayName(tier: PlanTier): string {
    return TIER_DISPLAY_NAME[tier];
}
