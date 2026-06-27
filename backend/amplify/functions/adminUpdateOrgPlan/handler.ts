import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminUpdateOrgPlan';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';
type PlanSource = 'grant' | 'manual';
type DeviceActivation = NonNullable<
    Awaited<ReturnType<typeof client.models.DeviceActivation.listDeviceActivationByOrganizationId>>['data']
>[number];

const SEAT_DEFAULTS: Record<PlanTier, number> = {
    free: 1,
    basic: 1,
    professional: 5,
    enterprise: 999999,
};

function normalizeTier(planTier: string | null | undefined) {
    const tier = (planTier ?? '').trim().toLowerCase();
    if (!['free', 'basic', 'professional', 'enterprise'].includes(tier)) {
        throw new Error('planTier must be free, basic, professional, or enterprise');
    }
    return tier as PlanTier;
}

function normalizeSource(planSource: string | null | undefined): PlanSource {
    const source = (planSource ?? 'manual').trim().toLowerCase();
    if (source !== 'grant' && source !== 'manual') {
        throw new Error('planSource must be grant or manual for admin-managed organizations');
    }
    return source;
}

async function revokeExcessSeats(
    organizationId: string,
    newMaxSeats: number,
    ownerId: string,
    activations: DeviceActivation[],
) {
    if (activations.length <= newMaxSeats) return [];

    const newestFirst = activations
        .slice()
        .sort((a, b) => new Date(b.activatedAt ?? 0).getTime() - new Date(a.activatedAt ?? 0).getTime());

    let reservedKey: string | null = null;
    if (newMaxSeats > 0) {
        const ownerActivations = newestFirst.filter((a) => a.userId === ownerId);
        const ownerOldest = ownerActivations
            .slice()
            .sort((a, b) => new Date(a.activatedAt ?? 0).getTime() - new Date(b.activatedAt ?? 0).getTime())[0];
        reservedKey = ownerOldest ? `${ownerOldest.userId}:${ownerOldest.deviceId}` : null;
    }

    const candidates = newestFirst.filter((a) => `${a.userId}:${a.deviceId}` !== reservedKey);
    const excessCount = activations.length - newMaxSeats;
    const toRevoke = candidates.slice(0, excessCount);

    for (const activation of toRevoke) {
        await client.models.DeviceActivation.delete({
            userId: activation.userId,
            deviceId: activation.deviceId,
        });
        console.log(
            `[adminUpdateOrgPlan] auto-revoked org=${organizationId} user=${activation.userId} device=${activation.deviceId} activatedAt=${activation.activatedAt}`,
        );
    }

    return toRevoke;
}

/**
 * Admin-only plan override for non-Stripe organizations.
 *
 * Stripe-backed orgs are intentionally blocked here. Their plan/subscription
 * state must move through Stripe webhooks so billing and licensing stay in sync.
 */
export const handler: Schema['AdminUpdateOrgPlan']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId, planTier, planSource, maxDevices, grantExpiresAt, reason } = event.arguments;
    const tier = normalizeTier(planTier);
    const source = normalizeSource(planSource);
    const actorUserId = ((event as any).identity?.sub as string | undefined) ?? null;

    const orgResult = await client.models.Organization.get({ id: organizationId });
    const org = orgResult.data;
    if (!org) {
        return { success: false, message: 'Organization not found' };
    }
    if (org.stripeCustomerId) {
        return {
            success: false,
            message: 'Stripe-backed organizations must be changed through Stripe billing workflows',
        };
    }

    const seats = maxDevices ?? SEAT_DEFAULTS[tier];
    if (!Number.isInteger(seats) || seats < 0) {
        return { success: false, message: 'maxDevices must be a non-negative integer' };
    }
    if (tier !== 'free' && seats === 0) {
        return { success: false, message: 'Paid-style admin tiers require at least one device slot' };
    }

    const devices = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({ organizationId });
    const activeDevices = devices.data ?? [];
    const revokedDevices = await revokeExcessSeats(organizationId, seats, org.ownerId, activeDevices);

    const newGrantExpiresAt = source === 'grant' ? (grantExpiresAt ?? null) : null;

    await client.models.Organization.update({
        id: organizationId,
        planTier: tier,
        planSource: source,
        maxDevices: seats,
        grantExpiresAt: newGrantExpiresAt,
        subscriptionStatus: null,
    });

    await client.models.AdminPlanAudit.create({
        organizationId,
        actorUserId,
        action: 'admin-update-plan',
        oldPlanTier: org.planTier ?? null,
        newPlanTier: tier,
        oldPlanSource: org.planSource ?? null,
        newPlanSource: source,
        oldMaxSeats: org.maxDevices ?? null,
        newMaxSeats: seats,
        oldGrantExpiresAt: org.grantExpiresAt ?? null,
        newGrantExpiresAt,
        reason: [
            reason ?? null,
            revokedDevices.length > 0
                ? `Auto-revoked ${revokedDevices.length} excess device slot${revokedDevices.length === 1 ? '' : 's'} newest-first.`
                : null,
        ].filter(Boolean).join(' ') || null,
    });

    return {
        success: true,
        message: revokedDevices.length > 0
            ? `Organization plan set to ${tier} (${source}); revoked ${revokedDevices.length} excess device slot${revokedDevices.length === 1 ? '' : 's'} newest-first.`
            : `Organization plan set to ${tier} (${source})`,
    };
};
