import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/claimDeviceCapacity';
import type { Schema } from '../../data/resource';
import { tierToLimits, type PlanTier } from '../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function isExpiredGrant(org: { planSource?: string | null; grantExpiresAt?: string | null }) {
    return org.planSource === 'grant' && !!org.grantExpiresAt && new Date(org.grantExpiresAt).getTime() <= Date.now();
}

// Return is typed as `any` to escape strict schema-ref checking on the optional
// `kickableDevices` array of refs to the `KickableDevice` custom type. This matches
// the pattern used by listOrgMembers and other handlers returning ref-array fields.
export const handler: Schema['ClaimDeviceCapacity']['functionHandler'] = async (event): Promise<any> => {
    const { deviceId, deviceName, organizationId: requestedOrgId } = event.arguments;
    const userId = (event as any).identity?.sub as string;

    if (!userId) throw new Error('Unauthorized');

    // Find user's memberships
    const memberships = await client.models.Membership.listMembershipByUserId({ userId });
    if (!memberships.data?.length) {
        return { success: false, message: 'No organization membership found. Join an organization first.' };
    }

    // Find orgs with active plans
    const orgsWithPlans: {
        orgId: string;
        name: string;
        planTier: string;
        planSource: string | null;
        maxDevices: number;
        grantExpiresAt: string | null;
    }[] = [];
    for (const membership of memberships.data) {
        const { data: org } = await client.models.Organization.get({ id: membership.organizationId });
        if (org?.planTier && !org.deletedAt && !isExpiredGrant(org)) {
            orgsWithPlans.push({
                orgId: org.id,
                name: org.name,
                planTier: org.planTier,
                planSource: org.planSource ?? null,
                maxDevices: org.maxDevices ?? 1,
                grantExpiresAt: org.grantExpiresAt ?? null,
            });
        }
    }

    if (orgsWithPlans.length === 0) {
        return { success: false, message: 'No active subscription found. Subscribe to a plan first.' };
    }

    // Pick the requested org, or default to first with a plan
    const targetOrg = requestedOrgId
        ? orgsWithPlans.find(o => o.orgId === requestedOrgId)
        : orgsWithPlans[0];

    if (!targetOrg) {
        return { success: false, message: 'Organization not found or has no active plan.' };
    }

    // Grant expiry enforcement for grant-sourced orgs only.
    if (targetOrg.planSource === 'grant' && targetOrg.grantExpiresAt) {
        const expires = new Date(targetOrg.grantExpiresAt).getTime();
        if (Date.now() > expires) {
            console.log(`[claimDeviceCapacity] Grant expired for org ${targetOrg.orgId} at ${targetOrg.grantExpiresAt}`);
            return {
                success: false,
                errorCode: 'GRANT_EXPIRED',
                message: 'Your plan grant has expired. Upgrade to keep using WanderAware.',
            };
        }
    }

    // Check if this device is already activated for this user
    const existing = await client.models.DeviceActivation.get({ userId, deviceId });
    if (existing.data) {
        // Already activated — update lastValidatedAt and return
        await client.models.DeviceActivation.update({
            userId,
            deviceId,
            lastValidatedAt: new Date().toISOString(),
            organizationId: targetOrg.orgId,
        });
        console.log(`[claimDeviceCapacity] Existing activation updated for user ${userId}, device ${deviceId}`);
        return {
            success: true,
            plan: targetOrg.planTier,
            orgName: targetOrg.name,
            organizationId: targetOrg.orgId,
            message: 'Device already activated.',
        };
    }

    // ── Per-user device cap check (industry standard) ────────────────────
    // A single user can only have N devices active in the same org at once.
    // This stops one member from consuming all of an org's seats with multiple
    // installs. Limits live in tierConstants.ts and are tier-dependent.
    // When this fails we return a `kickableDevices` payload so the web's
    // LoginScreen can render a "sign out from one of these devices?" modal
    // (Cursor / Linear / 1Password pattern).
    const limits = tierToLimits(targetOrg.planTier as PlanTier);
    const userActivations = await client.models.DeviceActivation.listDeviceActivationByUserId({ userId });
    const userDevicesInThisOrg = (userActivations.data ?? []).filter(
        (a) => a.organizationId === targetOrg.orgId,
    );
    if (userDevicesInThisOrg.length >= limits.maxDevicesPerUser) {
        return {
            success: false,
            errorCode: 'PER_USER_DEVICE_LIMIT',
            message: `You've reached your device limit (${userDevicesInThisOrg.length} of ${limits.maxDevicesPerUser}). Sign out from another device first.`,
            kickableDevices: userDevicesInThisOrg.map((d) => ({
                deviceId: d.deviceId,
                deviceName: d.deviceName ?? 'Unknown Device',
                lastValidatedAt: d.lastValidatedAt,
            })),
        };
    }

    // ── Org-wide seat cap check ───────────────────────────────────────────
    const orgActivations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
        organizationId: targetOrg.orgId,
    });
    const seatCount = orgActivations.data?.length ?? 0;

    if (seatCount >= targetOrg.maxDevices) {
        // Eventual consistency / duplicate browser-callback guard: if this exact
        // device already owns the seat, the claim is idempotent and should not flash
        // an org-seat-limit failure on the web.
        const latestExisting = await client.models.DeviceActivation.get({ userId, deviceId });
        if (latestExisting.data) {
            await client.models.DeviceActivation.update({
                userId,
                deviceId,
                lastValidatedAt: new Date().toISOString(),
                organizationId: targetOrg.orgId,
            });
            console.log(`[claimDeviceCapacity] Existing activation accepted after full-seat recheck for user ${userId}, device ${deviceId}`);
            return {
                success: true,
                plan: targetOrg.planTier,
                orgName: targetOrg.name,
                organizationId: targetOrg.orgId,
                message: 'Device already activated.',
            };
        }

        return {
            success: false,
            errorCode: 'ORG_SEAT_LIMIT',
            message: `Org seat limit reached: ${seatCount}/${targetOrg.maxDevices}. Ask your admin to upgrade or revoke an unused device.`,
        };
    }

    // Create new activation
    const now = new Date().toISOString();
    await client.models.DeviceActivation.create({
        userId,
        deviceId,
        deviceName: deviceName || 'Unknown Device',
        organizationId: targetOrg.orgId,
        activatedAt: now,
        lastValidatedAt: now,
    });

    // Re-count to guard against concurrent claims
    const recheck = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
        organizationId: targetOrg.orgId,
    });
    if ((recheck.data?.length ?? 0) > targetOrg.maxDevices) {
        // Rollback — delete the activation we just created
        await client.models.DeviceActivation.delete({ userId, deviceId });
        return {
            success: false,
            errorCode: 'ORG_SEAT_LIMIT',
            message: `Org seat limit reached (concurrent claim). Try again.`,
        };
    }

    console.log(`[claimDeviceCapacity] New activation for user ${userId}, device ${deviceId}, org ${targetOrg.orgId}`);
    return {
        success: true,
        plan: targetOrg.planTier,
        orgName: targetOrg.name,
        organizationId: targetOrg.orgId,
        message: 'Device activated successfully.',
    };
};
