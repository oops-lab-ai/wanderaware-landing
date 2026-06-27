import { defineFunction, secret } from '@aws-amplify/backend';

export const cancelDowngrade = defineFunction({
    name: 'cancelDowngrade',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
