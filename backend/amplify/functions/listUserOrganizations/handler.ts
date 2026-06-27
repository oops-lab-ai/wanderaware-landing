import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/listUserOrganizations';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

function isExpiredGrant(org: { planSource?: string | null; grantExpiresAt?: string | null }) {
    return org.planSource === 'grant' && !!org.grantExpiresAt && new Date(org.grantExpiresAt).getTime() <= Date.now();
}

export const handler: Schema['ListUserOrganizations']['functionHandler'] = async (event): Promise<any> => {
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // List caller's memberships
    const memberships = await client.models.Membership.listMembershipByUserId({ userId: callerId });

    const organizations = (await Promise.all(
        (memberships.data ?? []).map(async (membership) => {
            const orgResult = await client.models.Organization.get({ id: membership.organizationId });
            const org = orgResult.data;
            // Server-side filter: skip soft-deleted orgs entirely. The frontend never
            // needs to see them — they shouldn't appear in the org switcher, the
            // sidebar, or the auto-pick fallback in deriveSession.
            if (!org || org.deletedAt) return null;
            const expiredGrant = isExpiredGrant(org);
            return {
                organizationId: membership.organizationId,
                name: org.name ?? null,
                planTier: expiredGrant ? null : (org.planTier ?? null),
                maxDevices: expiredGrant ? 0 : (org.maxDevices ?? 1),
                role: membership.role ?? null,
                membershipId: membership.id
            };
        })
    )).filter((o) => o !== null);

    return { organizations };
};
