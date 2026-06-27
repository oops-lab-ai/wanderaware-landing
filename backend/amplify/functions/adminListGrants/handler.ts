import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminListGrants';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

/**
 * Returns all 'free' tier (plan grant / promo) orgs with their grant state.
 *
 * Powers the Admin → Grants tab in the dashboard. The schema gate
 * (`allow.groups(['admins'])`) is the primary auth; requireAdmin is defense-in-depth.
 */
export const handler: Schema['AdminListGrants']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    // Read all orgs and filter to grant-sourced orgs in-memory. There's no GSI on
    // planSource yet because this is bounded admin tooling.
    const orgs = await client.models.Organization.list({});
    const grantOrgs = (orgs.data ?? []).filter((o) => !o.deletedAt && o.planSource === 'grant');

    const now = Date.now();
    const grants = await Promise.all(
        grantOrgs.map(async (org) => {
            // Find the owner email by joining the membership table
            const memberships = await client.models.Membership.listMembershipByOrganizationId({
                organizationId: org.id,
            });
            const ownerMembership = memberships.data?.find((m) => m.role === 'owner');
            let ownerEmail: string | null = null;
            if (ownerMembership?.userId) {
                const profile = await client.models.Profile.get({ id: ownerMembership.userId });
                ownerEmail = profile.data?.email ?? null;
            }

            // Find which promo code (if any) was redeemed to create this org
            // Note: this is a scan over PromoRedemption — fine for small admin tooling.
            // Could be optimized with a GSI on organizationId if needed.
            const allRedemptions = await client.models.PromoRedemption.list({});
            const redemption = (allRedemptions.data ?? []).find((r) => r.organizationId === org.id);

            // Compute derived status
            const expiresAt = org.grantExpiresAt;
            let status: 'active' | 'expiring-soon' | 'expired' | 'permanent' = 'permanent';
            if (expiresAt) {
                const expiresMs = new Date(expiresAt).getTime();
                if (expiresMs < now) status = 'expired';
                else if (expiresMs - now < 7 * 24 * 60 * 60 * 1000) status = 'expiring-soon';
                else status = 'active';
            }

            return {
                organizationId: org.id,
                organizationName: org.name,
                ownerEmail,
                planTier: org.planTier,
                planSource: org.planSource,
                maxDevices: org.maxDevices,
                createdAt: org.createdAt,
                grantExpiresAt: expiresAt,
                status,
                sourceCode: redemption?.code ?? null,
            };
        }),
    );

    // Quick stats for the Grants page header
    const activeCount = grants.filter((g) => g.status === 'active' || g.status === 'expiring-soon' || g.status === 'permanent').length;
    const expiringSoonCount = grants.filter((g) => g.status === 'expiring-soon').length;

    return {
        grants,
        totalActive: activeCount,
        totalExpiringSoon: expiringSoonCount,
        totalEverGranted: grantOrgs.length,
    };
};
