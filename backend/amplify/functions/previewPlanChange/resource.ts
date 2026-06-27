import { defineFunction, secret } from '@aws-amplify/backend';

export const previewPlanChange = defineFunction({
    name: 'previewPlanChange',
    resourceGroupName: 'data',
    environment: {
        STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY')
    }
});
