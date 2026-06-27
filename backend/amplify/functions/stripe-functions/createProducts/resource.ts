import { defineFunction, secret } from '@aws-amplify/backend';

export const createProducts = defineFunction({
    name: `createProducts`,
    entry: './handler.ts',
    timeoutSeconds: 300,
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
