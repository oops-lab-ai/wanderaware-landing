import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/declineInvitation';
import { Schema } from '../../data/resource';
import { createHash } from 'node:crypto';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Schema['DeclineInvitation']['functionHandler'] = async (event) => {
    const { token } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Accept either a raw `ms_inv_*` token (email link) or a tokenHash (dashboard
    // discovery panel). Same heuristic + security model as acceptInvitation —
    // see that handler for the rationale.
    const tokenHash = token.startsWith('ms_inv_')
        ? createHash('sha256').update(token).digest('hex')
        : token;
    const invitationResult = await client.models.Invitation.get({ tokenHash });
    const invitation = invitationResult.data;

    if (!invitation) {
        throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
        throw new Error(`Invitation is already ${invitation.status}`);
    }

    if (new Date(invitation.expiresAt) < new Date()) {
        throw new Error('Invitation has expired');
    }

    // Get caller's email from Cognito
    const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID!,
        Username: callerId,
    }));
    const callerEmail = cognitoUser.UserAttributes?.find(a => a.Name === 'email')?.Value?.toLowerCase();

    if (!callerEmail) {
        throw new Error('Could not verify caller email');
    }

    if (callerEmail !== invitation.email.toLowerCase()) {
        throw new Error('Email does not match invitation');
    }

    // Re-read to minimize race window
    const freshInvitation = await client.models.Invitation.get({ tokenHash });
    if (freshInvitation.data?.status !== 'pending') {
        throw new Error('Invitation has already been accepted or is no longer pending');
    }

    // Check if a membership was already created by a concurrent accept
    const memberships = await client.models.Membership.listMembershipByOrganizationId({
        organizationId: invitation.organizationId
    });
    const alreadyMember = memberships.data?.find((m) => m.userId === callerId);
    if (alreadyMember) {
        throw new Error('Invitation has already been accepted');
    }

    // Update status to declined via Data client
    await client.models.Invitation.update({
        tokenHash,
        status: 'declined'
    });

    return { success: true, message: 'Invitation declined' };
};
