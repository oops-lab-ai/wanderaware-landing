/**
 * Creates the WanderAware subscription product and default pricing tiers in Stripe.
 *
 * Usage:
 *   $env:STRIPE_SECRET_KEY="sk_test_..."
 *   npx tsx backend/scripts/seed-stripe-products.ts
 */

import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
    console.error('Error: STRIPE_SECRET_KEY is not set.');
    process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' });

const TIERS = [
    {
        name: 'Starter',
        price: 79,
        planId: 'basic-monthly',
        tier: 'basic',
        isRecommended: false,
        features: ['Single building', 'Small door-reader capacity', 'Email support'],
    },
    {
        name: 'Professional',
        price: 99,
        planId: 'professional-monthly',
        tier: 'professional',
        isRecommended: true,
        features: ['Multi-door center', 'Expanded reader capacity', 'Priority support'],
    },
    {
        name: 'Enterprise',
        price: 249,
        planId: 'enterprise-monthly',
        tier: 'enterprise',
        isRecommended: false,
        features: ['Multi-location operations', 'Custom reader capacity', 'Dedicated support'],
    },
];

async function main() {
    console.log(`Using Stripe key: ${secretKey.substring(0, 12)}...`);

    const existing = await stripe.products.search({
        query: "active:'true' AND metadata['productType']:'wanderaware-subscription'",
    });

    let product = existing.data[0];
    if (product) {
        console.log(`Product exists: ${product.name} (${product.id})`);
    } else {
        product = await stripe.products.create({
            name: 'WanderAware',
            description: 'RFID-based wandering awareness for adult day care operations',
            metadata: { productType: 'wanderaware-subscription' },
        });
        console.log(`Created product: ${product.name} (${product.id})`);
    }

    for (const tier of TIERS) {
        const prices = await stripe.prices.search({
            query: `active:'true' AND product:'${product.id}' AND type:'recurring' AND metadata['planId']:'${tier.planId}'`,
        });

        if (prices.data.length > 0) {
            const price = prices.data[0];
            console.log(`  ${tier.name}: exists ($${tier.price}/mo) - ${price.id}`);
            continue;
        }

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: tier.price * 100,
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: {
                planId: tier.planId,
                planName: tier.name,
                tier: tier.tier,
                isRecommended: tier.isRecommended ? '1' : '0',
                features: JSON.stringify(tier.features),
            },
        });
        console.log(`  ${tier.name}: created ($${tier.price}/mo) - ${price.id}`);
    }

    console.log('Done. WanderAware products are ready in Stripe.');
}

main().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
