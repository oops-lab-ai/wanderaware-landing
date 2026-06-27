import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/listMyInvitations';
import { Schema } from '../../data/resource';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Returns the caller's pending, non-expired invitations across ALL organizations.
 *
 * Security: the caller's email is read from Cognito server-side via AdminGetUser,
 * NEVER from a client-supplied argument. Otherwise any signed-in user could list
 * any other user's pending invites by passing their email.
 *
 * Used by the dashboard's "Invitations to You" panel and sidebar badge so users
 * who sign up cold (no email link) can still discover invites that are waiting
 * for them.
 */
export const handler: Schema['ListMyInvitations']['functionHandler'] = async (event): Promise<any> => {
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Read email from Cognito — NOT from client args. The client never sees this Lambda's
    // email lookup happen, which is the entire point of the server-side check.
    const cognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID!,
        Username: callerId,
    }));
    const callerEmail = cognitoUser.UserAttributes?.find((a) => a.Name === 'email')?.Value?.toLowerCase();

    if (!callerEmail) {
        // Fail-soft: empty list, not an error. The dashboard renders an empty panel.
        return { invitations: [] };
    }

    // Query the email index on Invitation
    const result = await client.models.Invitation.listInvitationByEmail({ email: callerEmail });
    const now = new Date();

    const filtered = (result.data ?? []).filter((inv) => {
        if (inv.status !== 'pending') return false;
        if (!inv.expiresAt) return false;
        return new Date(inv.expiresAt) > now;
    });

    // Hydrate organization names + inviter emails for each invitation. Sequential
    // by invitation count, but the count is small (a single user with N pending
    // invites — typically 0–3), so the network cost is negligible.
    //
    // Soft-deleted target orgs are filtered out: users should never see invites
    // pointing to dead workspaces. The hydration step that loads the org name
    // is the natural place to detect this.
    const hydrated = await Promise.all(
        filtered.map(async (inv) => {
            let organizationName: string | null = null;
            let orgIsDeleted = false;
            let inviterEmail: string | null = null;

            try {
                const orgResult = await client.models.Organization.get({ id: inv.organizationId });
                if (!orgResult.data || orgResult.data.deletedAt) {
                    orgIsDeleted = true;
                } else {
                    organizationName = orgResult.data.name ?? null;
                }
            } catch (e) {
                console.warn(`[listMyInvitations] failed to load org ${inv.organizationId}`, e);
            }

            try {
                const profileResult = await client.models.Profile.get({ id: inv.invitedBy });
                inviterEmail = profileResult.data?.email ?? null;
            } catch (e) {
                console.warn(`[listMyInvitations] failed to load inviter profile ${inv.invitedBy}`, e);
            }

            if (orgIsDeleted) return null;

            return {
                tokenHash: inv.tokenHash,
                email: inv.email,
                role: inv.role ?? null,
                status: inv.status ?? null,
                invitedBy: inv.invitedBy,
                inviterEmail,
                organizationName,
                createdAt: inv.createdAt ?? null,
                expiresAt: inv.expiresAt ?? null,
            };
        }),
    );

    const invitations = hydrated.filter((i): i is NonNullable<typeof i> => i !== null);

    return { invitations };
};
