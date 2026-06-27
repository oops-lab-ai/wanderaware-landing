import { defineFunction, secret } from '@aws-amplify/backend';

export const createCheckoutSession = defineFunction({
    name: `createCheckoutSession`,
    entry: './handler.ts',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
        // FRONTEND_URL removed - now passed dynamically via baseUrl parameter
    }
});
