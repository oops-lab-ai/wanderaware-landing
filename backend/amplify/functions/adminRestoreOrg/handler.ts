import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminRestoreOrg';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['AdminRestoreOrg']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId } = event.arguments;
    const org = await client.models.Organization.get({ id: organizationId });
    if (!org.data) {
        return { success: false, message: 'Organization not found' };
    }
    if (!org.data.deletedAt) {
        return { success: false, message: 'Organization is not deleted' };
    }

    await client.models.Organization.update({
        id: organizationId,
        deletedAt: null,
        deletesTtl: null,
    });
    console.log(`[adminRestoreOrg] org=${organizationId}`);
    return { success: true, message: 'Organization restored' };
};
