import { secret } from '@aws-amplify/backend';
import { defineFunction } from '@aws-amplify/backend-function';

// Define the payment processor function
export const paymentProcessor = defineFunction({
    entry: './handler.ts',
    name: `paymentProcessor`,
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
