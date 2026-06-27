import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/transferOwnership';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['TransferOwnership']['functionHandler'] = async (event) => {
    const { organizationId, newOwnerMembershipId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // 1. Verify caller is the current owner of the org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || callerMembership.role !== 'owner') {
        throw new Error('Unauthorized: only the current owner can transfer ownership');
    }

    // 2. Get the new owner's membership by ID
    const newOwnerResult = await client.models.Membership.get({ id: newOwnerMembershipId });
    const newOwnerMembership = newOwnerResult.data;
    if (!newOwnerMembership) {
        throw new Error('New owner membership not found');
    }

    // 3. Verify new owner membership belongs to this org
    if (newOwnerMembership.organizationId !== organizationId) {
        throw new Error('Membership does not belong to this organization');
    }

    // 4. Verify new owner is not already the owner
    if (newOwnerMembership.role === 'owner') {
        throw new Error('This member is already the owner');
    }

    // 5. Transfer ownership — 3 sequential updates via Data client
    // Not atomic, but acceptable for low-concurrency science tool
    try {
        await client.models.Organization.update({
            id: organizationId,
            ownerId: newOwnerMembership.userId
        });

        await client.models.Membership.update({
            id: newOwnerMembershipId,
            role: 'owner'
        });

        await client.models.Membership.update({
            id: callerMembership.id,
            role: 'admin'
        });
    } catch (error) {
        console.error('Transfer ownership failed mid-update:', error);
        throw new Error('Ownership transfer failed — please contact support');
    }

    return { success: true, message: 'Ownership transferred' };
};
