import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminReleaseOrgDevice';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['AdminReleaseOrgDevice']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId, userId, deviceId } = event.arguments;
    const activation = await client.models.DeviceActivation.get({ userId, deviceId });
    if (!activation.data) {
        return { success: true, message: 'No activation found for this device' };
    }
    if (activation.data.organizationId !== organizationId) {
        return { success: false, message: 'Device does not belong to this organization' };
    }

    await client.models.DeviceActivation.delete({ userId, deviceId });
    console.log(`[adminReleaseOrgDevice] org=${organizationId} user=${userId} device=${deviceId}`);
    return { success: true, message: 'Device revoked. Seat released.' };
};
