import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/revokeInvitation';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['RevokeInvitation']['functionHandler'] = async (event) => {
    const { token, organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Verify caller is owner or admin of org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    // Look up Invitation by tokenHash directly (frontend sends the hash from ListInvitations)
    const invitationResult = await client.models.Invitation.get({ tokenHash: token });
    const invitation = invitationResult.data;

    if (!invitation) {
        throw new Error('Invitation not found');
    }

    // Verify invitation belongs to this org
    if (invitation.organizationId !== organizationId) {
        throw new Error('Invitation does not belong to this organization');
    }

    // Verify status is pending
    if (invitation.status !== 'pending') {
        throw new Error(`Invitation is already ${invitation.status}`);
    }

    // Delete the invitation
    await client.models.Invitation.delete({ tokenHash: token });

    return { success: true, message: 'Invitation revoked' };
};
