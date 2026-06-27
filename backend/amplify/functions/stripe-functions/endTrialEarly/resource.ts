import { defineFunction, secret } from '@aws-amplify/backend';

export const endTrialEarly = defineFunction({
    name: `endTrialEarly`,
    entry: './handler.ts',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    },
    timeoutSeconds: 30 // Increase timeout to 30 seconds for Stripe API calls
});
