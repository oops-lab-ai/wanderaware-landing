import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/getInvitationDetails';
import { Schema } from '../../data/resource';
import { createHash } from 'node:crypto';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['GetInvitationDetails']['functionHandler'] = async (event) => {
    const { token } = event.arguments;

    // No callerId check — guest access allowed

    // Email links carry the raw ms_inv_* token; dashboard discovery passes the hash.
    const tokenHash = token.startsWith('ms_inv_')
        ? createHash('sha256').update(token).digest('hex')
        : token;

    // Look up Invitation by tokenHash
    const invitationResult = await client.models.Invitation.get({ tokenHash });
    const invitation = invitationResult.data;

    if (!invitation) {
        return null;
    }

    // Get org name
    const orgResult = await client.models.Organization.get({ id: invitation.organizationId });
    if (!orgResult.data || orgResult.data.deletedAt) {
        return null;
    }
    const organizationName = orgResult.data.name ?? null;

    // Get inviter email
    const profileResult = await client.models.Profile.get({ id: invitation.invitedBy });
    const inviterEmail = profileResult.data?.email ?? null;

    // Check if expired
    const isExpired = new Date(invitation.expiresAt) < new Date();

    return {
        tokenHash: invitation.tokenHash,
        email: invitation.email,
        role: invitation.role ?? null,
        status: isExpired ? 'expired' : (invitation.status ?? null),
        invitedBy: invitation.invitedBy,
        inviterEmail,
        organizationName,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt
    };
};
