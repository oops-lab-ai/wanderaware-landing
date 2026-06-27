import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminGetUser';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

/**
 * Full user detail for the /admin/users/:userId page.
 * Includes profile, all memberships joined with org info, redemption history,
 * and Cognito status (enabled/confirmed/last activity) so the UI can render
 * a proper status badge and decide which action buttons to show.
 *
 * Falls back to Cognito-only data if no Profile record exists (e.g. user
 * was created via AdminCreateUser but never signed in, or their Profile
 * was deleted). An admin should always be able to see a Cognito user.
 */
export const handler: Schema['AdminGetUser']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    const { userId } = event.arguments;

    // Fetch Profile, Cognito status, memberships, and redemptions in parallel.
    // If Profile doesn't exist, we still return Cognito data so the admin
    // can see and manage the user.
    const [profile, cognitoResult, memberships, allRedemptions] = await Promise.all([
        client.models.Profile.get({ id: userId }),
        cognito
            .send(
                new AdminGetUserCommand({
                    UserPoolId: process.env.USER_POOL_ID!,
                    Username: userId,
                }),
            )
            .catch((err) => {
                console.error('[adminGetUser] Cognito lookup failed:', err);
                return null;
            }),
        client.models.Membership.listMembershipByUserId({ userId }),
        client.models.PromoRedemption.list({}),
    ]);

    // If neither Profile nor Cognito user exists, the user truly doesn't exist.
    if (!profile.data && !cognitoResult) {
        return { user: null, organizations: [], redemptions: [] };
    }

    // Derive email from Profile (preferred) or Cognito attributes (fallback).
    const cognitoEmail = cognitoResult?.UserAttributes?.find(
        (a) => a.Name === 'email',
    )?.Value ?? null;

    // Memberships joined with org info
    const orgs = await Promise.all(
        (memberships.data ?? []).map(async (m) => {
            const org = await client.models.Organization.get({ id: m.organizationId });
            return {
                membershipId: m.id,
                role: m.role,
                organizationId: m.organizationId,
                organizationName: org.data?.name ?? null,
                planTier: org.data?.planTier ?? null,
                planSource: org.data?.planSource ?? null,
                grantExpiresAt: org.data?.grantExpiresAt ?? null,
                deletedAt: org.data?.deletedAt ?? null,
            };
        }),
    );

    // Redemption history (small scan, fine for admin)
    const userRedemptions = (allRedemptions.data ?? []).filter((r) => r.userId === userId);

    return {
        user: {
            userId: profile.data?.id ?? userId,
            email: profile.data?.email ?? cognitoEmail,
            createdAt: profile.data?.createdAt ?? cognitoResult?.UserCreateDate?.toISOString() ?? null,
            newsLetter: profile.data?.newsLetter ?? null,
            enabled: cognitoResult?.Enabled ?? null,
            userStatus: cognitoResult?.UserStatus ?? null,
            lastModifiedAt: cognitoResult?.UserLastModifiedDate?.toISOString() ?? null,
        },
        organizations: orgs,
        redemptions: userRedemptions.map((r) => ({
            code: r.code,
            organizationId: r.organizationId,
            redeemedAt: r.redeemedAt,
        })),
    };
};
