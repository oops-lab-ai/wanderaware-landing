import { defineFunction } from '@aws-amplify/backend';

export const postAuthentication = defineFunction({
    name: 'postAuthentication',
    resourceGroupName: 'auth',
    memoryMB: 256,
    timeoutSeconds: 10,
    environment: {
        ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? '',
    },
});
