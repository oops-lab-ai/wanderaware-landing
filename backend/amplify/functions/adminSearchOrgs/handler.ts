import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminSearchOrgs';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

/**
 * Search orgs by name, owner email, or exact id. Returns the first 50 results.
 * Includes enough billing/plan state for the admin org index.
 */
export const handler: Schema['AdminSearchOrgs']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    const { query } = event.arguments;
    const needle = (query ?? '').trim().toLowerCase();

    const orgs = await client.models.Organization.list({});
    const enriched = await Promise.all(
        (orgs.data ?? []).map(async (o) => {
            const members = await client.models.Membership.listMembershipByOrganizationId({
                organizationId: o.id,
            });
            const devices = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
                organizationId: o.id,
            });
            const ownerProfile = o.ownerId
                ? await client.models.Profile.get({ id: o.ownerId })
                : { data: null };

            return {
                organizationId: o.id,
                name: o.name,
                ownerId: o.ownerId,
                ownerEmail: ownerProfile.data?.email ?? null,
                planTier: o.planTier,
                planSource: o.planSource,
                subscriptionStatus: o.subscriptionStatus,
                stripeCustomerId: o.stripeCustomerId,
                maxDevices: o.maxDevices,
                seatsUsed: devices.data?.length ?? 0,
                deviceCount: devices.data?.length ?? 0,
                grantExpiresAt: o.grantExpiresAt,
                memberCount: members.data?.length ?? 0,
                deletedAt: o.deletedAt,
            };
        }),
    );

    const filtered = enriched
        .filter(
            (o) =>
                !needle ||
                o.organizationId.toLowerCase() === needle ||
                (o.name && o.name.toLowerCase().includes(needle)) ||
                (o.ownerEmail && o.ownerEmail.toLowerCase().includes(needle)),
        )
        .slice(0, 50);

    const results = filtered;

    return { organizations: results };
};
