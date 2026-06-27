import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminDeleteUser';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

const GRACE_PERIOD_DAYS = 30;

/**
 * Hard-deletes a user. This is the "point of no return" action — after it
 * completes, the user row is gone from Cognito and the user's Profile +
 * Memberships + DeviceActivations are deleted from the data store. Any
 * organizations they solo-owned are soft-deleted with the same 30-day grace
 * period used by the normal owner-driven delete flow.
 *
 * Refuses to proceed if the user owns an org with other members. The admin
 * must transfer ownership first (mirrors the leaveOrganization contract) so
 * the multi-member org isn't orphaned.
 *
 * Order of operations matters: we clean up app data BEFORE calling
 * AdminDeleteUser. If the Cognito delete fails partway we may leave some
 * stale app rows but at least we haven't orphaned a Cognito user whose data
 * we already wiped.
 */
export const handler: Schema['AdminDeleteUser']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);
    const { userId } = event.arguments;

    try {
        // 1. Find every membership this user holds
        const memberships = await client.models.Membership.listMembershipByUserId({ userId });
        const memberRows = memberships.data ?? [];

        // 2. Scan orgs they own and decide which are solo (safe to soft-delete)
        //    vs. multi-member (refuse — require transfer first)
        const soloOwnedOrgs: string[] = [];
        for (const m of memberRows) {
            if (m.role !== 'owner') continue;
            const peers = await client.models.Membership.listMembershipByOrganizationId({
                organizationId: m.organizationId,
            });
            const otherMembers = (peers.data ?? []).filter((p) => p.userId !== userId).length;
            if (otherMembers > 0) {
                return {
                    success: false,
                    message: `User owns organization ${m.organizationId} with ${otherMembers} other member(s). Transfer ownership to one of those members first, then retry the delete.`,
                };
            }
            soloOwnedOrgs.push(m.organizationId);
        }

        // 3. Soft-delete solo-owned orgs (same pattern as removeOrganization)
        const now = new Date();
        const ttlDate = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        const ttl = Math.floor(ttlDate.getTime() / 1000);
        for (const orgId of soloOwnedOrgs) {
            await client.models.Organization.update({
                id: orgId,
                deletedAt: now.toISOString(),
                deletesTtl: ttl,
                planTier: null,
                maxDevices: 0,
            });
            console.log(`[adminDeleteUser] Soft-deleted solo-owned org ${orgId}`);
        }

        // 4. Delete every membership row (owner + non-owner alike)
        for (const m of memberRows) {
            await client.models.Membership.delete({ id: m.id });
        }

        // 5. Release every device slot the user held across any org
        const devices = await client.models.DeviceActivation.list({
            filter: { userId: { eq: userId } },
        });
        for (const d of devices.data ?? []) {
            await client.models.DeviceActivation.delete({
                userId: d.userId,
                deviceId: d.deviceId,
            });
        }

        // 6. Delete the Profile row
        await client.models.Profile.delete({ id: userId });

        // 7. Finally delete from Cognito — the point of no return. If this
        //    throws after app data is already gone we return a partial-success
        //    message so the admin knows to manually clean up the Cognito user.
        try {
            await cognito.send(new AdminDeleteUserCommand({
                UserPoolId: process.env.USER_POOL_ID!,
                Username: userId,
            }));
        } catch (cognitoErr: any) {
            console.error('[adminDeleteUser] Cognito delete failed (app data already cleaned):', cognitoErr);
            return {
                success: false,
                message: `App data cleaned but Cognito delete failed: ${cognitoErr?.message ?? 'unknown error'}. Manually delete from Cognito console.`,
            };
        }

        console.log(
            `[adminDeleteUser] Deleted ${userId}: ${memberRows.length} membership(s), ${devices.data?.length ?? 0} device(s), ${soloOwnedOrgs.length} solo-owned org(s) soft-deleted`,
        );
        return { success: true, message: 'User deleted' };
    } catch (err: any) {
        console.error('[adminDeleteUser] Failed:', err);
        return { success: false, message: err?.message ?? 'Failed to delete user' };
    }
};
