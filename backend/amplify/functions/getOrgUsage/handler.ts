import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/getOrgUsage';
import { Schema } from '../../data/resource';
import { tierToLimits, type PlanTier } from '../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function isExpiredGrant(org: { planSource?: string | null; grantExpiresAt?: string | null }) {
    return org.planSource === 'grant' && !!org.grantExpiresAt && new Date(org.grantExpiresAt).getTime() <= Date.now();
}

function assertNoGraphqlErrors(
    operation: string,
    errors: Array<{ message?: string | null }> | undefined,
): void {
    if (!errors?.length) return;
    const message = errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
    console.error(`[getOrgUsage] ${operation} failed: ${message}`);
    throw new Error(`${operation} failed: ${message}`);
}

/**
 * Returns real org usage based on DeviceActivation rows.
 *
 * Replaces the dead getPlanUsage Lambda which counted Plan records (always
 * 0 for orgs that signed up after the PKCE migration). The Overview "Device Capacity"
 * stat now reflects the actual number of devices claimed.
 *
 * Verifies caller membership in the org. Returns nulcare centerles on auth failure
 * rather than throwing because this is a read-only metric — failing closed is fine.
 */
export const handler: Schema['GetOrgUsage']['functionHandler'] = async (event) => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        return { planTier: null, seatsUsed: null, maxDevices: null, maxDevicesPerUser: null };
    }

    // Verify caller has membership in this org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership) {
        return { planTier: null, seatsUsed: null, maxDevices: null, maxDevicesPerUser: null };
    }

    // Fetch org for planTier and maxDevices
    const orgResult = await client.models.Organization.get({ id: organizationId });
    const org = orgResult.data;
    if (!org) {
        return { planTier: null, seatsUsed: null, maxDevices: null, maxDevicesPerUser: null };
    }

    const expiredGrant = isExpiredGrant(org);
    const planTier = expiredGrant ? null : (org.planTier ?? null);

    // Count actual DeviceActivation rows (the real device capacity usage). The Amplify
    // runtime config signs generated client requests with this function's role;
    // access is granted by allow.resource(getOrgUsage) in the data schema.
    const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({ organizationId });
    assertNoGraphqlErrors('DeviceActivation.listDeviceActivationByOrganizationId', activations.errors);
    const seatsUsed = activations.data?.length ?? 0;

    // Per-user device cap is tier-derived, not stored on the org row
    const maxDevicesPerUser = planTier ? tierToLimits(planTier as PlanTier).maxDevicesPerUser : null;

    return {
        planTier,
        seatsUsed,
        maxDevices: expiredGrant ? 0 : (org.maxDevices ?? 1),
        maxDevicesPerUser,
    };
};
