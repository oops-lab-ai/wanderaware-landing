import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/cancelDowngrade';
import type { Schema } from '../../data/resource';
import Stripe from 'stripe';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

export const handler: Schema['CancelDowngrade']['functionHandler'] = async (event) => {
    const { organizationId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) throw new Error('Unauthorized');

    // Verify caller is owner or admin
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin');
    }

    const { data: org } = await client.models.Organization.get({ id: organizationId });
    if (!org?.stripeCustomerId) throw new Error('No Stripe customer found');

    // Include trialing subs — a trialing customer who scheduled a downgrade can still cancel it.
    // Stripe's `status: 'active'` filter excludes trialing, so we list all and filter in-memory.
    const subscriptions = await stripe.subscriptions.list({
        customer: org.stripeCustomerId,
        status: 'all',
        limit: 10
    });

    const sub = subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (!sub) throw new Error('No active or trialing subscription');

    // Release the subscription schedule if one is attached
    if (sub.schedule) {
        const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id;
        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        if (schedule.status === 'active' || schedule.status === 'not_started') {
            await stripe.subscriptionSchedules.release(scheduleId);
            console.log(`[cancelDowngrade] Schedule ${scheduleId} released for org ${organizationId}`);
        }
    } else {
        console.log(`[cancelDowngrade] No schedule attached — clearing stale org fields for ${organizationId}`);
    }

    // Always clear scheduled downgrade from org (handles stale data)
    await client.models.Organization.update({
        id: organizationId,
        scheduledDowngradeTier: null,
        scheduledDowngradeDate: null
    });
    await client.models.AdminPlanAudit.create({
        organizationId,
        actorUserId: callerId,
        action: 'stripe-cancel-downgrade',
        oldPlanTier: org.planTier ?? null,
        newPlanTier: org.planTier ?? null,
        oldPlanSource: org.planSource ?? null,
        newPlanSource: org.planSource ?? null,
        oldMaxSeats: org.maxDevices ?? null,
        newMaxSeats: org.maxDevices ?? null,
        oldGrantExpiresAt: org.grantExpiresAt ?? null,
        newGrantExpiresAt: org.grantExpiresAt ?? null,
        reason: org.scheduledDowngradeTier
            ? `Cancelled scheduled downgrade to ${org.scheduledDowngradeTier}.`
            : 'Cleared stale scheduled downgrade fields.',
    });

    return {
        success: true,
        message: 'Pending downgrade cancelled. Your current plan will continue.'
    };
};
