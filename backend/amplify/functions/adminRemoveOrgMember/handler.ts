import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminRemoveOrgMember';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['AdminRemoveOrgMember']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId, membershipId } = event.arguments;
    const target = await client.models.Membership.get({ id: membershipId });
    if (!target.data || target.data.organizationId !== organizationId) {
        return { success: false, message: 'Membership not found in this organization' };
    }
    if (target.data.role === 'owner') {
        return { success: false, message: 'Cannot remove the organization owner' };
    }

    const activations = await client.models.DeviceActivation.listDeviceActivationByUserId({
        userId: target.data.userId,
    });
    let releasedSeats = 0;
    for (const activation of activations.data ?? []) {
        if (activation.organizationId !== organizationId || !activation.deviceId) continue;
        await client.models.DeviceActivation.delete({
            userId: activation.userId,
            deviceId: activation.deviceId,
        });
        releasedSeats++;
    }

    await client.models.Membership.delete({ id: membershipId });
    console.log(`[adminRemoveOrgMember] org=${organizationId} membership=${membershipId} releasedSeats=${releasedSeats}`);

    return {
        success: true,
        message: releasedSeats > 0
            ? `Member removed and ${releasedSeats} device slot${releasedSeats === 1 ? '' : 's'} released`
            : 'Member removed',
    };
};
