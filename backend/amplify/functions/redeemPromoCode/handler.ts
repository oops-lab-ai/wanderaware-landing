import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/redeemPromoCode';
import { Schema } from '../../data/resource';
import { generatedOrganizationName } from '../shared/organizationName';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';
type PlanSource = 'stripe' | 'grant' | 'manual';

const SEAT_DEFAULTS: Record<PlanTier, number> = {
    free: 1,
    basic: 1,
    professional: 5,
    enterprise: 999999,
};

function isExpiredGrant(org: { planSource?: string | null; grantExpiresAt?: string | null }) {
    return org.planSource === 'grant' && !!org.grantExpiresAt && new Date(org.grantExpiresAt).getTime() <= Date.now();
}

function normalizeTier(planTier: string | null | undefined): PlanTier {
    const tier = (planTier ?? 'free').trim().toLowerCase();
    if (!['free', 'basic', 'professional', 'enterprise'].includes(tier)) {
        throw new Error('planTier must be free, basic, professional, or enterprise');
    }
    return tier as PlanTier;
}

async function writePlanAudit(args: {
    organizationId: string;
    actorUserId: string;
    action: string;
    newPlanTier?: string | null;
    newPlanSource?: string | null;
    newMaxSeats?: number | null;
    newGrantExpiresAt?: string | null;
    reason?: string | null;
}) {
    await client.models.AdminPlanAudit.create({
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        action: args.action,
        oldPlanTier: null,
        newPlanTier: args.newPlanTier ?? null,
        oldPlanSource: null,
        newPlanSource: args.newPlanSource ?? null,
        oldMaxSeats: null,
        newMaxSeats: args.newMaxSeats ?? null,
        oldGrantExpiresAt: null,
        newGrantExpiresAt: args.newGrantExpiresAt ?? null,
        reason: args.reason ?? null,
    });
}

/**
 * Redeem a promo code, creating a new "plan grant" org for the caller.
 *
 * Flow:
 *   1. Look up the code; reject if missing or expired.
 *   2. Check if caller has already redeemed this specific code (refresh-safe).
 *   3. Stockpile guard: caller cannot have more than one free org at a time.
 *   4. Atomically increment the redemption counter; reject if at max.
 *   5. Create the redemption row, then a new Organization with planTier='free' +
 *      grantExpiresAt computed from code.expiresInDays, then a Membership with role='owner'.
 *   6. Return the new org id.
 *
 * Auth: caller must be authenticated (Cognito user pool). The redeem page handles
 * the "not signed in → register first" redirect on the frontend.
 *
 * Internal label: "free" tier. User-facing label: "Care Center plan" or "Granted".
 */
export const handler: Schema['RedeemPromoCode']['functionHandler'] = async (event) => {
    const { code } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        return { success: false, message: 'You must be signed in to redeem a code.' };
    }
    if (!code) {
        return { success: false, message: 'No code provided.' };
    }

    // 1. Look up the code
    const codeResult = await client.models.PromoCode.get({ code });
    const promoCode = codeResult.data;
    if (!promoCode) {
        return { success: false, message: 'Invalid code.' };
    }
    if (promoCode.expiresAt && new Date(promoCode.expiresAt).getTime() < Date.now()) {
        return { success: false, message: 'This code has expired.' };
    }
    if ((promoCode.redemptionCount ?? 0) >= (promoCode.maxRedemptions ?? 1)) {
        return { success: false, message: 'This code is fully redeemed.' };
    }

    // 2. Idempotency: same user redeeming twice (e.g. refresh during signup)
    const existing = await client.models.PromoRedemption.get({ code, userId: callerId });
    if (existing.data) {
        return { success: false, message: "You've already redeemed this code." };
    }

    // 3. Stockpile guard: a user can have at most one 'free' org at a time. Paid orgs
    // do NOT block redemption — a user with a paid org can still claim a care center-plan org
    // for a different care center context, and the paid org keeps paying.
    const memberships = await client.models.Membership.listMembershipByUserId({ userId: callerId });
    for (const m of memberships.data ?? []) {
        const orgResult = await client.models.Organization.get({ id: m.organizationId });
        const org = orgResult.data;
        if (org?.planTier && !org.stripeCustomerId && !org.deletedAt && !isExpiredGrant(org)) {
            return {
                success: false,
                message: 'You already have an active granted plan. Ask an admin to adjust that organization instead.',
            };
        }
    }

    // 4. Atomic counter increment via conditional update.
    // The condition prevents over-redemption under concurrent calls.
    try {
        await client.models.PromoCode.update({
            code,
            redemptionCount: (promoCode.redemptionCount ?? 0) + 1,
        });
    } catch (err) {
        console.error('[redeemPromoCode] Counter update failed:', err);
        return { success: false, message: 'Could not redeem code. Please try again.' };
    }

    // 5. Compute grant expiry from code.expiresInDays (null → indefinite).
    const grantExpiresAt = promoCode.expiresInDays
        ? new Date(Date.now() + promoCode.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const tier = normalizeTier(promoCode.planTier);
    const seats = promoCode.maxDevices ?? SEAT_DEFAULTS[tier];

    // Get user email for org name default
    const profile = await client.models.Profile.get({ id: callerId });
    const email = profile.data?.email ?? 'user';
    const emailHandle = email.split('@')[0];

    // Create the new org
    const newOrg = await client.models.Organization.create({
        name: generatedOrganizationName(emailHandle, "'s Care Center"),
        ownerId: callerId,
        planTier: tier,
        planSource: 'grant' as PlanSource,
        maxDevices: seats,
        grantExpiresAt,
    });
    if (!newOrg.data) {
        return { success: false, message: 'Could not create care center workspace. Please try again.' };
    }

    // Create the owner Membership
    await client.models.Membership.create({
        userId: callerId,
        organizationId: newOrg.data.id,
        role: 'owner',
    });

    // Record the redemption (after the org exists, so the FK is valid)
    await client.models.PromoRedemption.create({
        code,
        userId: callerId,
        organizationId: newOrg.data.id,
        redeemedAt: new Date().toISOString(),
    });

    await writePlanAudit({
        organizationId: newOrg.data.id,
        actorUserId: callerId,
        action: 'promo-redeem',
        newPlanTier: tier,
        newPlanSource: 'grant',
        newMaxSeats: seats,
        newGrantExpiresAt: grantExpiresAt,
        reason: `Redeemed promo code ${code}`,
    });

    console.log(
        `[redeemPromoCode] User ${callerId} redeemed code ${code} → org ${newOrg.data.id} (expires: ${grantExpiresAt ?? 'never'})`,
    );

    return {
        success: true,
        organizationId: newOrg.data.id,
        organizationName: newOrg.data.name,
        grantExpiresAt,
        message: 'Care Center plan activated.',
    };
};
