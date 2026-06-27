import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/releaseDevice';
import type { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function assertNoGraphqlErrors(
    operation: string,
    errors: Array<{ message?: string | null }> | undefined,
): void {
    if (!errors?.length) return;
    const message = errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
    console.error(`[releaseDevice] ${operation} failed: ${message}`);
    throw new Error(`${operation} failed: ${message}`);
}

export const handler: Schema['ReleaseDevice']['functionHandler'] = async (event) => {
    const { deviceId, targetUserId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) throw new Error('Unauthorized');

    // The user whose device we're releasing — defaults to the caller for the
    // existing web sign-out flow. The dashboard's Devices page passes a
    // targetUserId when an admin/owner revokes someone else's device.
    const ownerUserId = targetUserId || callerId;

    // Check if activation exists. The Amplify runtime config signs generated
    // client requests with this function's role; access is granted by
    // allow.resource(releaseDevice) in the data schema.
    const activationResult = await client.models.DeviceActivation.get({ userId: ownerUserId, deviceId });
    assertNoGraphqlErrors('DeviceActivation.get', activationResult.errors);
    const activation = activationResult.data;
    if (!activation) {
        return { success: true, message: 'No activation found for this device.' };
    }

    // Authorization: caller is allowed to release a device if either:
    //   - They own it (callerId === ownerUserId), or
    //   - They are an owner/admin in the same org as the device
    if (callerId !== ownerUserId) {
        const memberships = await client.models.Membership.listMembershipByOrganizationId({
            organizationId: activation.organizationId,
        });
        const callerMembership = memberships.data?.find((m) => m.userId === callerId);
        if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
            throw new Error('Not authorized to revoke this device');
        }
    }

    // Delete the activation (release the seat)
    const deleteResult = await client.models.DeviceActivation.delete({ userId: ownerUserId, deviceId });
    assertNoGraphqlErrors('DeviceActivation.delete', deleteResult.errors);

    console.log(
        `[releaseDevice] Released seat for user ${ownerUserId}, device ${deviceId}, org ${activation.organizationId} (caller: ${callerId})`,
    );
    return { success: true, message: 'Device revoked. Seat released.' };
};
