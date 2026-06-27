import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminUpdateGrant';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import { tierToLimits, type PlanTier } from '../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

async function getLatestRevokedGrantPlan(organizationId: string) {
    const audits = await client.models.AdminPlanAudit.listAdminPlanAuditByOrganizationId({ organizationId });
    const latestRevoke = (audits.data ?? [])
        .filter((audit) => audit?.action === 'grant-revoke')
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];

    const planTier = latestRevoke?.oldPlanTier as PlanTier | null | undefined;
    const maxDevices = latestRevoke?.oldMaxSeats ?? (planTier ? tierToLimits(planTier).maxDevices : null);
    return { planTier: planTier ?? null, maxDevices };
}

/**
 * Updates expiry for grant-sourced organizations only. Revoke removes active
 * entitlement fields; extension restores the most recent revoked tier.
 */
export const handler: Schema['AdminUpdateGrant']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId, action, extensionDays, customExpiresAt } = event.arguments;
    const actorUserId = ((event as any).identity?.sub as string | undefined) ?? null;

    const orgResult = await client.models.Organization.get({ id: organizationId });
    const org = orgResult.data;
    if (!org) {
        return { success: false, message: 'Organization not found' };
    }
    if (org.stripeCustomerId || org.planSource !== 'grant') {
        return { success: false, message: 'Grant actions only apply to grant-sourced organizations' };
    }

    let newGrantExpiresAt: string | null;
    let nextPlanTier = org.planTier ?? null;
    let nextMaxSeats = org.maxDevices ?? null;
    switch (action) {
        case 'revoke':
            newGrantExpiresAt = new Date().toISOString();
            nextPlanTier = null;
            nextMaxSeats = 0;
            break;
        case 'extend': {
            const days = extensionDays ?? 30;
            const base = org.grantExpiresAt
                ? Math.max(Date.now(), new Date(org.grantExpiresAt).getTime())
                : Date.now();
            newGrantExpiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
            if (!nextPlanTier) {
                const restored = await getLatestRevokedGrantPlan(organizationId);
                nextPlanTier = restored.planTier ?? 'free';
                nextMaxSeats = restored.maxDevices ?? tierToLimits(nextPlanTier as PlanTier).maxDevices;
            }
            break;
        }
        case 'permanent':
            newGrantExpiresAt = null;
            if (!nextPlanTier) {
                const restored = await getLatestRevokedGrantPlan(organizationId);
                nextPlanTier = restored.planTier ?? 'free';
                nextMaxSeats = restored.maxDevices ?? tierToLimits(nextPlanTier as PlanTier).maxDevices;
            }
            break;
        case 'set-custom':
            if (!customExpiresAt) {
                return { success: false, message: 'customExpiresAt is required for set-custom' };
            }
            newGrantExpiresAt = customExpiresAt;
            if (!nextPlanTier) {
                const restored = await getLatestRevokedGrantPlan(organizationId);
                nextPlanTier = restored.planTier ?? 'free';
                nextMaxSeats = restored.maxDevices ?? tierToLimits(nextPlanTier as PlanTier).maxDevices;
            }
            break;
        default:
            return { success: false, message: `Unknown action: ${action}` };
    }

    await client.models.Organization.update({
        id: organizationId,
        grantExpiresAt: newGrantExpiresAt,
        planTier: nextPlanTier,
        maxDevices: nextMaxSeats,
    });

    await client.models.AdminPlanAudit.create({
        organizationId,
        actorUserId,
        action: `grant-${action}`,
        oldPlanTier: org.planTier ?? null,
        newPlanTier: nextPlanTier,
        oldPlanSource: org.planSource ?? null,
        newPlanSource: org.planSource ?? null,
        oldMaxSeats: org.maxDevices ?? null,
        newMaxSeats: nextMaxSeats,
        oldGrantExpiresAt: org.grantExpiresAt ?? null,
        newGrantExpiresAt,
        reason: action,
    });

    console.log(
        `[adminUpdateGrant] org ${organizationId} action=${action} new grantExpiresAt=${newGrantExpiresAt ?? 'null'}`,
    );

    return {
        success: true,
        grantExpiresAt: newGrantExpiresAt,
        message: `Grant ${action} applied`,
    };
};
