import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia'
});

export const handler = async () => {
    try {
        const subscriptionProducts = await stripe.products.search({
            query: "active:'true' AND metadata['productType']:'wanderaware-subscription'"
        });

        const subscriptionProduct = subscriptionProducts.data[0];
        if (!subscriptionProduct) {
            return { subscriptionProducts: [] };
        }

        const subscriptionPrices = await stripe.prices.search({
            query: `active:'true' AND product:'${subscriptionProduct.id}' AND type:'recurring'`
        });

        const formattedSubscriptionProducts = subscriptionPrices.data.map((price) => {
            const features = JSON.parse(price.metadata.features || '[]');
            return {
                id: subscriptionProduct.id,
                name: price.metadata.planName,
                description: subscriptionProduct.description,
                price: price.unit_amount ? price.unit_amount / 100 : 0,
                priceId: price.id,
                type: price.type,
                planId: price.metadata.planId,
                tier: price.metadata.tier || null,
                isRecommended: price.metadata.isRecommended === '1',
                marketingFeatures: features,
                interval: price.recurring?.interval,
                intervalCount: price.recurring?.interval_count
            };
        });

        // Sort by price ascending (least to greatest)
        formattedSubscriptionProducts.sort((a, b) => a.price - b.price);

        return {
            subscriptionProducts: formattedSubscriptionProducts
        };
    } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
    }
};
