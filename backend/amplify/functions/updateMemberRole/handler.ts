import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/updateMemberRole';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['UpdateMemberRole']['functionHandler'] = async (event) => {
    const { organizationId, membershipId, role } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // 1. Verify caller is the owner of the org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || callerMembership.role !== 'owner') {
        throw new Error('Unauthorized: only the owner can change member roles');
    }

    // 2. Get target membership by ID
    const targetResult = await client.models.Membership.get({ id: membershipId });
    const targetMembership = targetResult.data;
    if (!targetMembership) {
        throw new Error('Membership not found');
    }

    // 3. Verify target belongs to this org
    if (targetMembership.organizationId !== organizationId) {
        throw new Error('Membership does not belong to this organization');
    }

    // 4. Verify target is not the owner (use transferOwnership instead)
    if (targetMembership.role === 'owner') {
        throw new Error('Cannot change the owner role. Use transferOwnership instead');
    }

    // 5. Verify caller is not targeting themselves
    if (targetMembership.userId === callerId) {
        throw new Error('Cannot change your own role');
    }

    // 6. Update membership role
    await client.models.Membership.update({ id: membershipId, role });

    // 7. Return success
    return { success: true, message: 'Role updated' };
};
