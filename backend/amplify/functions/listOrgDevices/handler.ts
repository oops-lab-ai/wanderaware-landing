import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/listOrgDevices';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

// Devices that haven't checked in within 5 minutes are considered "idle".
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function assertNoGraphqlErrors(
    operation: string,
    errors: Array<{ message?: string | null }> | undefined,
): void {
    if (!errors?.length) return;
    const message = errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
    console.error(`[listOrgDevices] ${operation} failed: ${message}`);
    throw new Error(`${operation} failed: ${message}`);
}

/**
 * List all DeviceActivation rows for an org, joined with each user's email.
 *
 * Authorization rules:
 *   - Caller must have a membership in the org.
 *   - Owners and admins see ALL devices in the org (with email join).
 *   - Viewers see ONLY their own devices (no email join — it's always them).
 *
 * The viewer-mode filter is enforced server-side, not just hidden in the UI.
 */
// Return type widened to `any` to escape strict schema-ref checking on the
// `devices: a.ref('DeviceItem').array()` field.
export const handler: Schema['ListOrgDevices']['functionHandler'] = async (event): Promise<any> => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) throw new Error('Unauthorized');

    // Verify caller membership and capture role
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership) {
        throw new Error('Not a member of this organization');
    }
    const isAdminOrOwner = callerMembership.role === 'owner' || callerMembership.role === 'admin';

    // Fetch the org for seat counts
    const orgResult = await client.models.Organization.get({ id: organizationId });
    const org = orgResult.data;
    if (!org) throw new Error('Organization not found');

    // Fetch all device activations for the org. The Amplify runtime config signs
    // generated client requests with this function's role; access is granted by
    // allow.resource(listOrgDevices) in the data schema.
    const allActivations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({ organizationId });
    assertNoGraphqlErrors('DeviceActivation.listDeviceActivationByOrganizationId', allActivations.errors);
    const activationRows = (allActivations.data ?? []).filter((row) => row?.userId && row?.deviceId);
    const totalDevicesUsed = activationRows.length;

    // For viewers, only return their own rows.
    const visibleRows = isAdminOrOwner
        ? activationRows
        : activationRows.filter((a) => a.userId === callerId);

    // Join user emails — owners/admins need them, viewers don't (they only see themselves).
    // Email lookup is the only N+1 cost; it's bounded by org seat count which is small (<=999).
    const now = Date.now();
    const devices = await Promise.all(
        visibleRows.map(async (row) => {
            let email: string | null = null;
            if (isAdminOrOwner) {
                const profile = await client.models.Profile.get({ id: row.userId });
                assertNoGraphqlErrors('Profile.get', profile.errors);
                email = profile.data?.email ?? null;
            }
            const lastValidated = row.lastValidatedAt ? new Date(row.lastValidatedAt).getTime() : 0;
            const isOnline = now - lastValidated < ONLINE_THRESHOLD_MS;
            return {
                userId: row.userId,
                email,
                deviceId: row.deviceId,
                deviceName: row.deviceName ?? 'Unknown Device',
                activatedAt: row.activatedAt,
                lastValidatedAt: row.lastValidatedAt,
                isOnline,
            };
        }),
    );

    return {
        devices,
        totalDevicesUsed,
        maxDevices: org.maxDevices ?? 1,
    };
};
