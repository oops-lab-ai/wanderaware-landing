import Stripe from 'stripe';
import { Schema } from '../../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/endTrialEarly';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia'
});

export const handler: Schema['EndTrialEarly']['functionHandler'] = async (event) => {
    const { userId, organizationId } = event.arguments;
    console.log('EndTrialEarly called for userId:', userId, 'orgId:', organizationId);

    if (!userId || !organizationId) {
        throw new Error('Missing required parameters');
    }

    // Enforce identity binding
    const callerUserId = (event as any)?.identity?.sub || (event as any)?.identity?.claims?.sub;
    if (!callerUserId || callerUserId.toString() !== userId?.toString()) {
        throw new Error('Unauthorized: userId does not match authenticated user');
    }

    // Verify caller is owner or admin of the org
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerUserId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    try {
        // Get Organization for stripeCustomerId
        const orgResult = await client.models.Organization.get({ id: organizationId });
        const org = orgResult.data;
        const customerId = org?.stripeCustomerId;

        if (!customerId) {
            throw new Error('No Stripe customer ID found for organization');
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'trialing',
            limit: 100
        });

        // Find the trial subscription that belongs to this org
        const subscription = subscriptions.data.find(
            (sub) => sub.status === 'trialing' && sub.metadata?.organizationId === organizationId
        );

        if (!subscription) {
            throw new Error('No active trial subscription found for this organization');
        }

        console.log(`Ending trial early for subscription: ${subscription.id}`);

        const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
            trial_end: 'now',
            metadata: {
                ...subscription.metadata,
                organizationId,
                userId: userId!
            }
        });

        console.log(`Trial ended successfully. New status: ${updatedSubscription.status}`);

        return {
            success: true,
            subscriptionId: subscription.id,
            newStatus: updatedSubscription.status,
            message: 'Trial ended successfully. You now have access to your full subscription benefits!'
        };
    } catch (error) {
        console.error('Error ending trial early:', error);
        throw error;
    }
};
