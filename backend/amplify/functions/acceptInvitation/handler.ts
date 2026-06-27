import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/acceptInvitation';
import { Schema } from '../../data/resource';
import { createHash } from 'node:crypto';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient({});

export const handler: Schema['AcceptInvitation']['functionHandler'] = async (event) => {
    const { token } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Accept either:
    //   • a raw `ms_inv_*` token from the email link → hash it now
    //   • an already-hashed tokenHash from the dashboard's MyInvitationsCard
    //     (the listMyInvitations Lambda only ever exposes hashes — the raw token
    //     never leaves the email)
    // Heuristic: raw tokens carry the `ms_inv_` prefix, hashes are 64 hex chars.
    // Email-match check below is the actual security boundary; this is just routing.
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

    const orgResult = await client.models.Organization.get({ id: invitation.organizationId });
    if (!orgResult.data || orgResult.data.deletedAt) {
        throw new Error('This invitation is no longer available');
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

    // Claim the invitation — update status to 'accepted' via Data client
    // Re-read to minimize race window, then update
    const freshInvitation = await client.models.Invitation.get({ tokenHash });
    if (freshInvitation.data?.status !== 'pending') {
        // Check if already a member
        const memberships = await client.models.Membership.listMembershipByOrganizationId({
            organizationId: invitation.organizationId
        });
        const existing = memberships.data?.find((m) => m.userId === callerId);
        if (existing) {
            return { success: true, organizationId: invitation.organizationId, role: invitation.role ?? null, message: 'Already a member' };
        }
        throw new Error('Invitation has already been claimed');
    }

    const freshOrg = await client.models.Organization.get({ id: invitation.organizationId });
    if (!freshOrg.data || freshOrg.data.deletedAt) {
        throw new Error('This invitation is no longer available');
    }

    await client.models.Invitation.update({
        tokenHash,
        status: 'accepted'
    });

    // Create membership — check before and after to prevent duplicates
    const memberships = await client.models.Membership.listMembershipByOrganizationId({
        organizationId: invitation.organizationId
    });
    const existingMembership = memberships.data?.find((m) => m.userId === callerId);

    if (!existingMembership) {
        try {
            await client.models.Membership.create({
                userId: callerId,
                organizationId: invitation.organizationId,
                role: invitation.role ?? 'viewer'
            });

            // Re-check for duplicates created by concurrent requests
            const recheck = await client.models.Membership.listMembershipByOrganizationId({
                organizationId: invitation.organizationId
            });
            const duplicates = recheck.data?.filter((m) => m.userId === callerId);
            if (duplicates && duplicates.length > 1) {
                // Keep the first one, delete the rest
                for (const dup of duplicates.slice(1)) {
                    await client.models.Membership.delete({ id: dup.id });
                }
            }
        } catch (membershipError) {
            // Revert invite status so user can retry
            console.error('Membership creation failed, reverting invitation claim:', membershipError);
            try {
                await client.models.Invitation.update({
                    tokenHash,
                    status: 'pending'
                });
            } catch (revertError) {
                console.error('Failed to revert invitation status:', revertError);
            }
            throw membershipError;
        }
    }

    return { success: true, organizationId: invitation.organizationId, role: invitation.role ?? null, message: 'Invitation accepted' };
};
