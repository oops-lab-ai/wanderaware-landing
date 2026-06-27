import { defineFunction, secret } from '@aws-amplify/backend';

export const getProducts = defineFunction({
    name: `getProducts`,
    entry: './handler.ts',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
