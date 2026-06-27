import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminGetOrg';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

/**
 * Full org detail for the /admin/orgs/[orgId] page.
 * Includes plan info, all members joined with profile email, all device activations.
 */
export const handler: Schema['AdminGetOrg']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    const { organizationId } = event.arguments;

    const orgResult = await client.models.Organization.get({ id: organizationId });
    const org = orgResult.data;
    if (!org) return { organization: null };

    // Members joined with email
    const memberships = await client.models.Membership.listMembershipByOrganizationId({
        organizationId,
    });
    const members = await Promise.all(
        (memberships.data ?? []).filter(Boolean).map(async (m) => {
            const profile = await client.models.Profile.get({ id: m.userId });
            return {
                membershipId: m.id,
                userId: m.userId,
                email: profile.data?.email ?? null,
                role: m.role,
            };
        }),
    );

    // Devices
    const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
        organizationId,
    });
    const devices = (activations.data ?? [])
        .filter(Boolean)
        .slice()
        .sort((a, b) => new Date(b.activatedAt ?? 0).getTime() - new Date(a.activatedAt ?? 0).getTime())
        .map((a) => ({
            userId: a.userId,
            deviceId: a.deviceId,
            deviceName: a.deviceName,
            activatedAt: a.activatedAt,
            lastValidatedAt: a.lastValidatedAt,
            organizationId: a.organizationId,
        }));

    const audits = await client.models.AdminPlanAudit.listAdminPlanAuditByOrganizationId({
        organizationId,
    });
    const auditLog = (audits.data ?? [])
        .filter(Boolean)
        .slice()
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 50)
        .map((a) => ({
            id: a.id,
            organizationId: a.organizationId,
            actorUserId: a.actorUserId,
            action: a.action,
            oldPlanTier: a.oldPlanTier,
            newPlanTier: a.newPlanTier,
            oldPlanSource: a.oldPlanSource,
            newPlanSource: a.newPlanSource,
            oldMaxSeats: a.oldMaxSeats,
            newMaxSeats: a.newMaxSeats,
            oldGrantExpiresAt: a.oldGrantExpiresAt,
            newGrantExpiresAt: a.newGrantExpiresAt,
            reason: a.reason,
            createdAt: a.createdAt,
        }));

    return {
        organization: {
            id: org.id,
            name: org.name,
            ownerId: org.ownerId,
            stripeCustomerId: org.stripeCustomerId,
            planTier: org.planTier,
            planSource: org.planSource,
            maxDevices: org.maxDevices,
            seatsUsed: devices.length,
            deviceCount: devices.length,
            subscriptionStatus: org.subscriptionStatus,
            cancelAtPeriodEnd: org.cancelAtPeriodEnd,
            currentPeriodEnd: org.currentPeriodEnd,
            scheduledDowngradeTier: org.scheduledDowngradeTier,
            scheduledDowngradeDate: org.scheduledDowngradeDate,
            grantExpiresAt: org.grantExpiresAt,
            deletedAt: org.deletedAt,
            createdAt: org.createdAt,
        },
        members,
        devices,
        auditLog,
    };
};
