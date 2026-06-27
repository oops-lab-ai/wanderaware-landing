import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/removeOrganization';
import { Schema } from '../../data/resource';
import Stripe from 'stripe';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const GRACE_PERIOD_DAYS = 30;
const STRIPE_DELETE_BLOCKING_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);

export const handler: Schema['RemoveOrganization']['functionHandler'] = async (event) => {
    const { organizationId, confirmName } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // 1. Verify caller is the owner
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || callerMembership.role !== 'owner') {
        throw new Error('Only the organization owner can delete it');
    }

    // 2. Get the org and verify name confirmation
    const { data: org } = await client.models.Organization.get({ id: organizationId });
    if (!org) {
        throw new Error('Organization not found');
    }

    if (org.deletedAt) {
        throw new Error('Organization is already scheduled for deletion');
    }

    if (confirmName !== org.name) {
        throw new Error('Organization name does not match. Please type the exact name to confirm.');
    }

    // 3. (Removed: "cannot delete your only org" check.) The dashboard now handles
    // the zero-org state via /welcome — users can delete their last org and land
    // on a flow that lets them accept a pending invite or create a new workspace.
    // See ORG_SYSTEM.md "Zero-org state and the /welcome route" for the full contract.

    // 4. Block deletion while Stripe still has a live billing relationship.
    // Do not cancel here: deleting an org should not silently forfeit prepaid time.
    if (org.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
            const subscriptions = await stripe.subscriptions.list({
                customer: org.stripeCustomerId,
                status: 'all',
                limit: 100,
            });
            const blocking = subscriptions.data.filter((sub) => STRIPE_DELETE_BLOCKING_STATUSES.has(sub.status));
            if (blocking.length > 0) {
                const statuses = [...new Set(blocking.map((sub) => sub.status))].join(', ');
                console.log(`[deleteOrg] Blocking delete for org ${organizationId}; Stripe subscription status: ${statuses}`);
                throw new Error('Cancel your subscription before deleting this organization.');
            }
        } catch (stripeErr) {
            if (stripeErr instanceof Error && stripeErr.message === 'Cancel your subscription before deleting this organization.') {
                throw stripeErr;
            }
            console.error('[deleteOrg] Stripe live subscription check failed:', stripeErr);
            throw new Error('Could not verify subscription status. Please try again before deleting this organization.');
        }
    }

    // 5. Release all device capacity for this org so they don't count against any
    // future re-creation of the org and so devices stop validating successfully.
    const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
        organizationId
    });
    for (const activation of activations.data ?? []) {
        await client.models.DeviceActivation.delete({
            userId: activation.userId,
            deviceId: activation.deviceId
        });
    }
    console.log(`[deleteOrg] Released ${activations.data?.length ?? 0} device capacity for org ${organizationId}`);

    // 6. Soft delete — deletedAt hides the org; deletesTtl is only a cleanup/restore marker for now.
    const now = new Date();
    const ttlDate = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await client.models.Organization.update({
        id: organizationId,
        deletedAt: now.toISOString(),
        deletesTtl: Math.floor(ttlDate.getTime() / 1000),
        planTier: null,
        maxDevices: 0
    });

    const invitations = await client.models.Invitation.listInvitationByOrganizationId({ organizationId });
    let revokedInvites = 0;
    for (const invitation of invitations.data ?? []) {
        if (invitation.status === 'pending') {
            await client.models.Invitation.delete({ tokenHash: invitation.tokenHash });
            revokedInvites++;
        }
    }
    console.log(`[deleteOrg] Revoked ${revokedInvites} pending invitations for org ${organizationId}`);

    console.log(`[deleteOrg] Organization ${organizationId} soft-deleted. Will be purged after ${ttlDate.toISOString()}`);

    return {
        success: true,
        message: `Organization scheduled for deletion. You have ${GRACE_PERIOD_DAYS} days to restore it.`,
        deletedAt: now.toISOString(),
        expiresAt: ttlDate.toISOString()
    };
};
