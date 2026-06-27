import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminGrantOrg';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
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

function normalizeTier(planTier: string | null | undefined) {
    const tier = (planTier ?? 'free').trim().toLowerCase();
    if (!['free', 'basic', 'professional', 'enterprise'].includes(tier)) {
        throw new Error('planTier must be free, basic, professional, or enterprise');
    }
    return tier as PlanTier;
}

async function writePlanAudit(args: {
    organizationId: string;
    actorUserId: string | null;
    newPlanTier: string;
    newMaxSeats: number;
    newGrantExpiresAt: string | null;
    reason: string;
}) {
    await client.models.AdminPlanAudit.create({
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        action: 'admin-grant',
        oldPlanTier: null,
        newPlanTier: args.newPlanTier,
        oldPlanSource: null,
        newPlanSource: 'grant',
        oldMaxSeats: null,
        newMaxSeats: args.newMaxSeats,
        oldGrantExpiresAt: null,
        newGrantExpiresAt: args.newGrantExpiresAt,
        reason: args.reason,
    });
}

/**
 * Admin-direct grant: creates a new plan grant org for a specific user, no promo code
 * involved. Used by the /admin/users/[userId] detail page "Grant org" button.
 *
 * Same logic as redeemPromoCode minus the code lookup. Still enforces the
 * "one free org per user" stockpile guard.
 */
export const handler: Schema['AdminGrantOrg']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { targetUserId, expiresInDays, planTier, maxDevices } = event.arguments;
    const actorUserId = ((event as any).identity?.sub as string | undefined) ?? null;
    const tier = normalizeTier(planTier);
    const seats = maxDevices ?? SEAT_DEFAULTS[tier];
    if (!Number.isInteger(seats) || seats < 0) {
        return { success: false, organizationId: null, message: 'maxDevices must be a non-negative integer' };
    }
    if (tier !== 'free' && seats === 0) {
        return { success: false, organizationId: null, message: 'Granted tiers require at least one device slot' };
    }

    // Stockpile guard
    const memberships = await client.models.Membership.listMembershipByUserId({ userId: targetUserId });
    for (const m of memberships.data ?? []) {
        const orgResult = await client.models.Organization.get({ id: m.organizationId });
        if (orgResult.data?.planTier && !orgResult.data.stripeCustomerId && !orgResult.data.deletedAt) {
            return {
                success: false,
                organizationId: null,
                message: 'User already has an active admin-granted plan',
            };
        }
    }

    // Compute grant expiry
    const grantExpiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    // Get user email for the org name default
    const profile = await client.models.Profile.get({ id: targetUserId });
    const email = profile.data?.email ?? 'user';
    const emailHandle = email.split('@')[0];

    // Create the new org
    const newOrg = await client.models.Organization.create({
        name: generatedOrganizationName(emailHandle, "'s Care Center"),
        ownerId: targetUserId,
        planTier: tier,
        planSource: 'grant' as PlanSource,
        maxDevices: seats,
        grantExpiresAt,
        subscriptionStatus: null,
    });
    if (!newOrg.data) {
        return { success: false, organizationId: null, message: 'Failed to create org' };
    }

    // Create the owner Membership
    await client.models.Membership.create({
        userId: targetUserId,
        organizationId: newOrg.data.id,
        role: 'owner',
    });

    await writePlanAudit({
        organizationId: newOrg.data.id,
        actorUserId,
        newPlanTier: tier,
        newMaxSeats: seats,
        newGrantExpiresAt: grantExpiresAt,
        reason: `Granted from admin user detail to ${targetUserId}`,
    });

    console.log(
        `[adminGrantOrg] Granted ${tier} org ${newOrg.data.id} to ${targetUserId} deviceSlots=${seats} expires=${grantExpiresAt ?? 'never'}`,
    );

    return {
        success: true,
        organizationId: newOrg.data.id,
        message: 'Care Center plan granted',
    };
};
