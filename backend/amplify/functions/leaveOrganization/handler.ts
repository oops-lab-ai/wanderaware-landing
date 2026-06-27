import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/leaveOrganization';
import { Schema } from '../../data/resource';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

/**
 * Lets a user remove their own membership from an org. Two protective rules:
 *   • Owner cannot leave — must transfer ownership first.
 *   • Last admin cannot leave if other (non-admin, non-owner) members remain
 *     — must promote someone first. (Defensive rule; in care operations where
 *     each org always has exactly one owner, this rarely fires.)
 *
 * METABOLOMICS-SPECIFIC: also cascades a release of the leaving user's web
 * seats in this org. Without this, the user keeps ghost DeviceActivation rows
 * that still count against Organization.maxDevices. Other members' devices are
 * untouched — we filter the user's activations server-side by org id, not by
 * caller membership.
 */
export const handler: Schema['LeaveOrganization']['functionHandler'] = async (event) => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        return { success: false, message: 'Unauthorized' };
    }

    // 1. Find caller's membership in this org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership) {
        return { success: false, message: 'You are not a member of this organization' };
    }

    // 2. Owner cannot leave — must transfer first
    if (callerMembership.role === 'owner') {
        return { success: false, message: 'Transfer ownership before leaving this organization.' };
    }

    // 3. Last admin cannot leave if other (non-admin, non-owner) members remain.
    // Defensive — in healthy orgs an owner always exists, so otherAdminsOrOwner
    // is non-empty as long as anyone else is in the org. The rule still costs
    // nothing and protects against pathological states (e.g. an org whose owner
    // record was manually deleted).
    if (callerMembership.role === 'admin') {
        const otherAdminsOrOwner = (memberships.data ?? []).filter(
            (m) => m.id !== callerMembership.id && (m.role === 'admin' || m.role === 'owner'),
        );
        const otherMembers = (memberships.data ?? []).filter((m) => m.id !== callerMembership.id);
        if (otherAdminsOrOwner.length === 0 && otherMembers.length > 0) {
            return {
                success: false,
                message: 'Promote another admin before leaving — you are the last one.',
            };
        }
    }

    // 4. Cascade-release the caller's device capacity in this org. Use the userId
    // index so we only touch the leaving user's rows; other members' devices stay.
    try {
        const activations = await client.models.DeviceActivation.listDeviceActivationByUserId({ userId: callerId });
        for (const a of activations.data ?? []) {
            if (a.organizationId === organizationId) {
                await client.models.DeviceActivation.delete({ userId: a.userId, deviceId: a.deviceId });
            }
        }
    } catch (err) {
        // Don't block the leave on a seat-release failure — log and continue.
        // The seat record becoming an orphan is preferable to the user being trapped.
        console.error('[leaveOrganization] Failed to cascade-release device capacity:', err);
    }

    // 5. Delete the membership row
    await client.models.Membership.delete({ id: callerMembership.id });

    return { success: true, message: 'You have left the organization' };
};
