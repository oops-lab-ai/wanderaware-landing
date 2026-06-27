import Stripe from 'stripe';
import { Schema } from '../../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/createBillingPortal';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia'
});

export const handler: Schema['CreateBillingPortal']['functionHandler'] = async (event) => {
    const { userId, organizationId, returnUrl, baseUrl } = event.arguments;
    console.log(JSON.stringify(event));

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

    const effectiveBaseUrl = baseUrl || (returnUrl ? new URL(returnUrl).origin : null) || process.env.FRONTEND_URL;
    const portalReturnUrl = returnUrl || `${effectiveBaseUrl}/dashboard`;

    try {
        // Get subscription products for plan switching
        const subscriptionProducts = await stripe.products.search({
            query: "active:'true' AND metadata['productType']:'wanderaware-subscription'"
        });

        if (!subscriptionProducts.data.length) {
            throw new Error('No active subscription products found');
        }

        // Get Organization for stripeCustomerId
        const orgResult = await client.models.Organization.get({ id: organizationId });
        const org = orgResult.data;
        const customerId = org?.stripeCustomerId;

        if (!customerId) {
            throw new Error('No Stripe customer ID found for organization');
        }

        // Get prices for subscription products (for plan switching)
        const allPrices = await stripe.prices.list({ active: true });

        const subscriptionUpdateProducts = subscriptionProducts.data
            .map((product) => {
                const productPrices = allPrices.data
                    .filter((price) => price.product === product.id && price.type === 'recurring')
                    .map((price) => price.id);

                return {
                    product: product.id,
                    prices: productPrices
                };
            })
            .filter((item) => item.prices.length > 0);

        // Check if customer has a trial subscription
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 1
        });

        const isTrialing = subscriptions.data.some((sub) => sub.status === 'trialing');

        const configuration = await stripe.billingPortal.configurations.create({
            features: {
                payment_method_update: { enabled: true },
                subscription_cancel: {
                    enabled: true,
                    mode: 'at_period_end',
                    cancellation_reason: {
                        enabled: true,
                        options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other']
                    }
                },
                subscription_update: {
                    enabled: false,
                    proration_behavior: 'none',
                    default_allowed_updates: [],
                    products: []
                },
                invoice_history: { enabled: true },
                customer_update: {
                    enabled: true,
                    allowed_updates: ['email', 'address', 'phone', 'tax_id']
                }
            },
            default_return_url: portalReturnUrl || '',
            business_profile: {
                headline: isTrialing ? 'Upgrade your trial or manage your subscription' : 'Manage your subscription',
                privacy_policy_url: `${effectiveBaseUrl}/privacy-policy`,
                terms_of_service_url: `${effectiveBaseUrl}/terms-of-service`
            }
        });

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            configuration: configuration.id,
            return_url: portalReturnUrl
        });

        console.log('Billing Portal Session created:', session);

        return {
            url: session.url
        };
    } catch (error) {
        console.error('Error creating billing portal session:', error);
        throw error;
    }
};
