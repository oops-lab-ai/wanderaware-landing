import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia'
});

const tiers = [
    {
        name: 'Individual',
        price: 49.0,
        metadata: { planId: 'basic-monthly', tier: 'basic' },
        features: ['1 user', '3 devices per user', 'Full analysis engine', 'Email support']
    },
    {
        name: 'Team',
        price: 99.0,
        metadata: { planId: 'professional-monthly', tier: 'professional', isRecommended: '1' },
        features: ['5 users', '3 devices per user', 'Full analysis engine', 'Priority support']
    },
    {
        name: 'Enterprise',
        price: 249.0,
        metadata: { planId: 'enterprise-monthly', tier: 'enterprise' },
        features: ['Unlimited users', '5 devices per user', 'Full analysis engine', 'Dedicated support']
    }
];

export const handler = async () => {
    try {
        // Get or create the subscription product
        const subscriptionProducts = await stripe.products.search({
            query: "active:'true' AND metadata['productType']:'wanderaware-subscription'"
        });

        let subscriptionProduct = subscriptionProducts.data[0];

        if (!subscriptionProduct) {
            subscriptionProduct = await stripe.products.create({
                name: 'WanderAware',
                description: 'Web adult day care wandering awareness for standardized compound identification',
                metadata: {
                    productType: 'wanderaware-subscription'
                }
            });
        }

        // Create prices for each tier if they don't exist
        for (const tier of tiers) {
            const prices = await stripe.prices.search({
                query: `active:'true' AND product:'${subscriptionProduct.id}' AND type:'recurring' AND metadata['planId']:'${tier.metadata.planId}'`
            });

            if (prices.data.length === 0) {
                await stripe.prices.create({
                    product: subscriptionProduct.id,
                    unit_amount: Math.round(tier.price * 100),
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                        interval_count: 1
                    },
                    metadata: {
                        planId: tier.metadata.planId,
                        planName: tier.name,
                        tier: tier.metadata.tier,
                        isRecommended: tier.metadata.isRecommended || '0',
                        features: JSON.stringify(tier.features)
                    }
                });
                console.log(`Created price for tier: ${tier.name}`);
            } else {
                console.log(`Price already exists for tier: ${tier.name}`);
            }
        }

        return {
            success: true,
            message: 'Products and prices created/verified successfully'
        };
    } catch (error) {
        console.error('Error creating products:', error);
        throw error;
    }
};
