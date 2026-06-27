import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/restoreOrganization';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['RestoreOrganization']['functionHandler'] = async (event) => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Verify caller is the owner
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || callerMembership.role !== 'owner') {
        throw new Error('Only the organization owner can restore it');
    }

    const { data: org } = await client.models.Organization.get({ id: organizationId });
    if (!org) {
        throw new Error('Organization not found');
    }

    if (!org.deletedAt) {
        throw new Error('Organization is not deleted');
    }

    // Clear soft delete fields — org is restored but without a subscription
    // User needs to re-subscribe manually
    await client.models.Organization.update({
        id: organizationId,
        deletedAt: null,
        deletesTtl: null
    });

    console.log(`[restoreOrg] Organization ${organizationId} restored by ${callerId}`);

    return {
        success: true,
        message: 'Organization restored. Subscribe to a plan to re-enable device capacity.'
    };
};
