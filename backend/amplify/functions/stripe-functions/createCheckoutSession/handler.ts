import Stripe from 'stripe';
import { Schema } from '../../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/createCheckoutSession';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia'
});

export const handler: Schema['CreateCheckoutSession']['functionHandler'] = async (event) => {
    const { productId, userId, priceId, organizationId, successUrl, cancelUrl, includeTrial, baseUrl } = event.arguments;

    if (!productId || !userId || !organizationId || !priceId) {
        throw new Error('Missing required parameters (productId, userId, organizationId, priceId are required)');
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

    console.log('Creating Checkout Session for product:', productId, 'org:', organizationId);

    const effectiveBaseUrl =
        baseUrl ||
        (successUrl ? new URL(successUrl).origin : null) ||
        (cancelUrl ? new URL(cancelUrl).origin : null) ||
        process.env.FRONTEND_URL;

    const checkoutSuccessUrl = successUrl || `${effectiveBaseUrl}/app/home?session_id={CHECKOUT_SESSION_ID}`;
    const checkoutCancelUrl = cancelUrl || `${effectiveBaseUrl}/app/price/price1`;

    try {
        // Get Organization for billing info
        const orgResult = await client.models.Organization.get({ id: organizationId });
        const org = orgResult.data;
        if (!org) {
            throw new Error('Organization not found');
        }

        // Get Profile for email
        const { data: profiles } = await client.models.Profile.list({
            filter: { id: { eq: userId?.toString() } }
        });
        const profile = profiles[0];
        if (!profile?.email) {
            throw new Error('User profile or email not found');
        }

        // Strict 1-customer-per-org model. We deliberately do NOT match by email —
        // the same human can own multiple orgs and each gets its own Stripe customer
        // with its own billing address, tax id, and dispute history.
        let customer = org.stripeCustomerId ?? null;

        // Defense-in-depth: if DynamoDB lost the link (or the webhook hasn't landed
        // from a previous attempt), find the existing customer by org metadata.
        // Note: customers.search is eventually consistent (~15s lag), so this won't
        // catch a customer created in the last few seconds — that's what the
        // idempotency key on customers.create below is for.
        if (!customer) {
            try {
                const search = await stripe.customers.search({
                    query: `metadata['organizationId']:'${organizationId}'`,
                    limit: 1,
                });
                if (search.data.length > 0) {
                    customer = search.data[0].id;
                    await client.models.Organization.update({
                        id: organizationId,
                        stripeCustomerId: customer,
                    });
                    console.log(`[createCheckoutSession] Recovered customer ${customer} via metadata search`);
                }
            } catch (err) {
                console.warn('[createCheckoutSession] Customer metadata search failed:', err);
            }
        }

        // Still no customer — pre-create one explicitly with org metadata.
        // We do this BEFORE checkout (rather than letting Checkout auto-create via
        // customer_email) for two reasons:
        //   1. customer_email creates a customer without org metadata, so the next
        //      metadata search wouldn't find it and we'd duplicate on the next click.
        //   2. We can pass an idempotency key — two parallel checkout requests for
        //      the same org will both get the same customer back from Stripe rather
        //      than creating two distinct customers.
        if (!customer) {
            const created = await stripe.customers.create(
                {
                    email: profile.email,
                    metadata: {
                        organizationId,
                        userId: userId.toString(),
                    },
                },
                {
                    idempotencyKey: `customer-create-org-${organizationId}`,
                },
            );
            customer = created.id;
            await client.models.Organization.update({
                id: organizationId,
                stripeCustomerId: customer,
            });
            console.log(`[createCheckoutSession] Pre-created customer ${customer} for org ${organizationId}`);
        }

        // Fetch product
        const product = await stripe.products.retrieve(productId);
        if (!product.active) {
            throw new Error('Product is not active');
        }

        // Get price
        let price;
        if (priceId) {
            price = await stripe.prices.retrieve(priceId);
            if (!price.active) {
                throw new Error('Price is not active');
            }
            if (price.product !== productId) {
                throw new Error('Price does not belong to the specified product');
            }
        } else {
            const prices = await stripe.prices.list({
                product: productId,
                active: true,
                type: 'recurring',
                limit: 1
            });
            if (prices.data.length === 0) {
                throw new Error('No active subscription price found for product');
            }
            price = prices.data[0];
        }

        if (!price.recurring) {
            throw new Error('Only subscription products are supported');
        }

        // Check Stripe for existing active subscription
        if (customer) {
            try {
                const stripeSubscriptions = await stripe.subscriptions.list({
                    customer: customer,
                    status: 'all',
                    limit: 100
                });

                const activeStripeSubscription = stripeSubscriptions.data.find(
                    (sub) => (sub.status === 'active' || sub.status === 'trialing') && sub.metadata?.organizationId === organizationId
                );

                if (activeStripeSubscription) {
                    const statusMessage =
                        activeStripeSubscription.status === 'trialing'
                            ? 'You are already on a trial'
                            : 'You already have an active subscription';
                    throw new Error(`${statusMessage}. Please manage your existing subscription instead of creating a new one.`);
                }
            } catch (stripeError: any) {
                // Detect stale customer — Stripe returns "No such customer" or
                // resource_missing when the customer was deleted from Stripe but
                // our DynamoDB still has the old ID. Clear the stale reference
                // and re-create a fresh customer so checkout can proceed.
                const isStaleCustomer =
                    (stripeError.code === 'resource_missing' && stripeError.param === 'customer') ||
                    (stripeError.type === 'invalid_request_error' && stripeError.message?.includes('No such customer'));

                if (isStaleCustomer) {
                    console.log(`[createCheckoutSession] Customer ${customer} no longer exists in Stripe, re-creating`);
                    await client.models.Organization.update({
                        id: organizationId,
                        stripeCustomerId: null,
                    });

                    // Re-create the customer (same logic as the initial creation above)
                    const created = await stripe.customers.create(
                        {
                            email: profile.email,
                            metadata: { organizationId, userId: userId!.toString() },
                        },
                        { idempotencyKey: `customer-recreate-org-${organizationId}-${Date.now()}` },
                    );
                    customer = created.id;
                    await client.models.Organization.update({
                        id: organizationId,
                        stripeCustomerId: customer,
                    });
                    console.log(`[createCheckoutSession] Re-created customer ${customer} for org ${organizationId}`);
                } else {
                    throw stripeError;
                }
            }
        }

        const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
            mode: 'subscription',
            line_items: [
                {
                    price: price.id,
                    quantity: 1
                }
            ],
            success_url: checkoutSuccessUrl,
            cancel_url: checkoutCancelUrl,
            client_reference_id: userId.toString(),
            billing_address_collection: 'required',
            consent_collection: {
                terms_of_service: 'required'
            },
            custom_text: {
                terms_of_service_acceptance: {
                    message: `I agree to the [Terms of Service](${effectiveBaseUrl}/terms-of-service) and [Privacy Policy](${effectiveBaseUrl}/privacy-policy)`
                }
            }
        };

        // customer is guaranteed set by the pre-creation block above; this assertion
        // is just for the type narrower (the runtime path always assigns it).
        if (!customer) throw new Error('Failed to resolve Stripe customer');
        sessionParams.customer = customer;

        // Critical: set organizationId in subscription metadata for webhook routing
        sessionParams.subscription_data = {
            metadata: {
                organizationId: organizationId,
                userId: userId.toString()
            }
        };

        // Trial eligibility is USER-LEVEL, not org-level. A single user could otherwise
        // create unlimited orgs to claim unlimited 7-day trials. Profile.hasUsedTrial
        // tracks whether THIS user has ever started a trial across any org. Cleared only
        // by an admin (and only intentionally, e.g. for compensated support cases).
        if (includeTrial && !profile.hasUsedTrial) {
            sessionParams.subscription_data.trial_period_days = 7;
        }

        sessionParams.metadata = {
            organizationId: organizationId,
            userId: userId.toString()
        };

        console.log('Creating Checkout Session with params:', {
            mode: sessionParams.mode,
            trial_period_days: sessionParams.subscription_data?.trial_period_days,
            customer,
            organizationId,
            metadata: sessionParams.metadata
        });

        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log('Checkout Session created:', {
            id: session.id,
            mode: session.mode,
            subscription: session.subscription,
            url: session.url
        });

        return {
            sessionId: session.id,
            url: session.url
        };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
};
