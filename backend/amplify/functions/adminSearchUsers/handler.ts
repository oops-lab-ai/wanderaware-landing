import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminSearchUsers';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

type CognitoSnapshot = {
    enabled: boolean | null;
    userStatus: string | null;
    lastModifiedAt: string | null;
};

/**
 * Search users by email substring. Case-insensitive contains match. Returns
 * the first 50 results. For each match we also fetch a Cognito snapshot
 * (enabled/userStatus/lastModifiedAt) so the table can render a status badge.
 */
export const handler: Schema['AdminSearchUsers']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    const { query } = event.arguments;
    const needle = (query ?? '').trim().toLowerCase();

    const profiles = await client.models.Profile.list({});
    const filtered = (profiles.data ?? [])
        .filter((p) => p.email && p.email.toLowerCase().includes(needle))
        .slice(0, 50);

    // Batch fetch Cognito status for all matched profiles in one ListUsers call
    // per unique email prefix. ListUsers doesn't do contains — only starts-with
    // on email — so for a mixed result set we just skip the Cognito join and
    // fall back to the list-users-for-the-full-set approach: fetch everything
    // with one call and build a lookup map.
    const cognitoMap = new Map<string, CognitoSnapshot>();
    if (filtered.length > 0) {
        try {
            // Pull up to 60 users in one call. For small admin user bases this
            // is a single round-trip; for larger bases this code path falls
            // back to skipping the Cognito join, which still keeps search
            // functional — the UI just hides the badge.
            const result = await cognito.send(
                new ListUsersCommand({
                    UserPoolId: process.env.USER_POOL_ID!,
                    Limit: 60,
                }),
            );
            for (const u of (result.Users ?? []) as UserType[]) {
                const sub = u.Attributes?.find((a) => a.Name === 'sub')?.Value;
                if (!sub) continue;
                cognitoMap.set(sub, {
                    enabled: u.Enabled ?? null,
                    userStatus: u.UserStatus ?? null,
                    lastModifiedAt: u.UserLastModifiedDate?.toISOString() ?? null,
                });
            }
        } catch (err) {
            // Non-fatal — the search still works, just without status badges.
            console.error('[adminSearchUsers] Cognito ListUsers failed:', err);
        }
    }

    // For each match, count their memberships so the table shows "X orgs"
    const users = await Promise.all(
        filtered.map(async (p) => {
            const memberships = await client.models.Membership.listMembershipByUserId({ userId: p.id });
            const snapshot = cognitoMap.get(p.id);
            return {
                userId: p.id,
                email: p.email,
                createdAt: p.createdAt,
                orgCount: memberships.data?.length ?? 0,
                enabled: snapshot?.enabled ?? null,
                userStatus: snapshot?.userStatus ?? null,
                lastModifiedAt: snapshot?.lastModifiedAt ?? null,
            };
        }),
    );

    return { users };
};
