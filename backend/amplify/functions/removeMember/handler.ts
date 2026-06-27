import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/removeMember';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function assertNoGraphqlErrors(
    operation: string,
    errors: Array<{ message?: string | null }> | undefined,
): void {
    if (!errors?.length) return;
    const message = errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ');
    console.error(`[removeMember] ${operation} failed: ${message}`);
    throw new Error(`${operation} failed: ${message}`);
}

export const handler: Schema['RemoveMember']['functionHandler'] = async (event) => {
    const { organizationId, membershipId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Verify caller is owner or admin of the org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    // Get the target membership
    const targetResult = await client.models.Membership.get({ id: membershipId });
    const target = targetResult.data;
    if (!target || target.organizationId !== organizationId) {
        throw new Error('Membership not found in this organization');
    }

    // Cannot remove the owner
    if (target.role === 'owner') {
        throw new Error('Cannot remove the organization owner');
    }

    // Admins can only remove viewers (not other admins)
    if (callerMembership.role === 'admin' && target.role !== 'viewer') {
        throw new Error('Admins can only remove viewers');
    }

    const releasedSeats = await releaseMemberDeviceActivations(target.userId, organizationId);

    await client.models.Membership.delete({ id: membershipId });

    return {
        success: true,
        message: releasedSeats > 0
            ? `Member removed and ${releasedSeats} device slot${releasedSeats === 1 ? '' : 's'} released`
            : 'Member removed',
    };
};

async function releaseMemberDeviceActivations(userId: string, organizationId: string): Promise<number> {
    const activations = await client.models.DeviceActivation.listDeviceActivationByUserId({ userId });
    assertNoGraphqlErrors('DeviceActivation.listDeviceActivationByUserId', activations.errors);

    let releasedSeats = 0;
    for (const activation of activations.data ?? []) {
        if (activation.organizationId !== organizationId || !activation.deviceId) continue;
        const deleteResult = await client.models.DeviceActivation.delete({ userId, deviceId: activation.deviceId });
        assertNoGraphqlErrors('DeviceActivation.delete', deleteResult.errors);
        releasedSeats++;
    }

    return releasedSeats;
}
