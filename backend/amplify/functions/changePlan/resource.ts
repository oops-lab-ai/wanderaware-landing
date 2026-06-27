import { defineFunction, secret } from '@aws-amplify/backend';

export const changePlan = defineFunction({
    name: 'changePlan',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
