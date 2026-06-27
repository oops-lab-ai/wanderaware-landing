import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/validateDeviceCapacity';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['ValidateDeviceCapacity']['functionHandler'] = async (event) => {
    const { deviceId } = event.arguments;
    const userId = (event as any).identity?.sub as string;

    if (!userId) throw new Error('Unauthorized');

    // Look up existing activation
    const { data: activation } = await client.models.DeviceActivation.get({ userId, deviceId });
    if (!activation) {
        return { valid: false, message: 'Device not activated. Please sign in again.' };
    }

    const memberships = await client.models.Membership.listMembershipByOrganizationId({
        organizationId: activation.organizationId,
    });
    const currentMembership = memberships.data?.find((m) => m.userId === userId);
    if (!currentMembership) {
        return { valid: false, message: 'You are no longer a member of this organization.' };
    }

    // Verify org still has an active plan
    const { data: org } = await client.models.Organization.get({ id: activation.organizationId });
    if (!org || !org.planTier || org.deletedAt) {
        return { valid: false, message: 'Organization subscription is no longer active.' };
    }

    // Grant expiry enforcement (free-tier orgs only). Runs on every periodic
    // validate poll, so admin Revoke / time-based expiry kick already-running
    // web sessions within minutes — not just on next launch.
    if (org.planSource === 'grant' && org.grantExpiresAt) {
        const expires = new Date(org.grantExpiresAt).getTime();
        if (Date.now() > expires) {
            console.log(`[validateDeviceCapacity] Grant expired for org ${org.id} at ${org.grantExpiresAt}`);
            return {
                valid: false,
                message: 'Your plan grant has expired. Upgrade to keep using WanderAware.',
            };
        }
    }

    // Update lastValidatedAt
    await client.models.DeviceActivation.update({
        userId,
        deviceId,
        lastValidatedAt: new Date().toISOString(),
    });

    console.log(`[validateDeviceCapacity] Validated user ${userId}, device ${deviceId}, org ${org.id}`);
    return {
        valid: true,
        plan: org.planTier,
        orgName: org.name,
        message: null,
    };
};
