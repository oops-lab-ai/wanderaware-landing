import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminUpdateOrgMemberRole';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['AdminUpdateOrgMemberRole']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { organizationId, membershipId, role } = event.arguments;
    if (role !== 'admin' && role !== 'viewer') {
        return { success: false, message: 'Admin role changes can only set admin or viewer. Use ownership transfer for owners.' };
    }

    const target = await client.models.Membership.get({ id: membershipId });
    if (!target.data || target.data.organizationId !== organizationId) {
        return { success: false, message: 'Membership not found in this organization' };
    }
    if (target.data.role === 'owner') {
        return { success: false, message: 'Cannot change the owner role from admin controls' };
    }

    await client.models.Membership.update({ id: membershipId, role });
    console.log(`[adminUpdateOrgMemberRole] org=${organizationId} membership=${membershipId} role=${role}`);
    return { success: true, message: 'Member role updated' };
};
