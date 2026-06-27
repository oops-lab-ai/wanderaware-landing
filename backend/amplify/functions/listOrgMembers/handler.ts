import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/listOrgMembers';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['ListOrgMembers']['functionHandler'] = async (event): Promise<any> => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Verify caller is member of org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership) {
        throw new Error('Unauthorized: not a member of this organization');
    }

    // Build member list with profile emails
    const members = await Promise.all(
        (memberships.data ?? []).map(async (m) => {
            const profileResult = await client.models.Profile.get({ id: m.userId });
            const profile = profileResult.data;
            return {
                membershipId: m.id,
                userId: m.userId,
                email: profile?.email ?? null,
                role: m.role ?? null,
                joinedAt: m.createdAt
            };
        })
    );

    return { members };
};
