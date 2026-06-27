import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/fetchInvitations';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['FetchInvitations']['functionHandler'] = async (event): Promise<any> => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // 1. Verify caller is owner or admin of the org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    // 2. List invitations by org
    const invitationsResult = await client.models.Invitation.listInvitationByOrganizationId({ organizationId });
    const allInvitations = invitationsResult.data ?? [];

    // 3. Filter: only pending and not expired
    const now = new Date();
    const activeInvitations = allInvitations.filter(
        (inv) => inv.status === 'pending' && new Date(inv.expiresAt) > now
    );

    // 4. Get org name
    const orgResult = await client.models.Organization.get({ id: organizationId });
    const organizationName = orgResult.data?.name ?? '';

    // 5. For each invitation, get inviter email
    const invitations = await Promise.all(
        activeInvitations.map(async (inv) => {
            const profileResult = await client.models.Profile.get({ id: inv.invitedBy });
            const inviterEmail = profileResult.data?.email ?? '';

            return {
                tokenHash: inv.tokenHash,
                email: inv.email,
                role: inv.role ?? '',
                status: inv.status ?? '',
                invitedBy: inv.invitedBy,
                inviterEmail,
                organizationName,
                createdAt: inv.createdAt,
                expiresAt: inv.expiresAt
            };
        })
    );

    // 6. Return invitations
    return { invitations };
};
