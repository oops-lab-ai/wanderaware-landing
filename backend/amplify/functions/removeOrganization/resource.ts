import { defineFunction, secret } from '@aws-amplify/backend';

export const removeOrganization = defineFunction({
    name: 'removeOrganization',
    resourceGroupName: 'data',
    timeoutSeconds: 30,
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
