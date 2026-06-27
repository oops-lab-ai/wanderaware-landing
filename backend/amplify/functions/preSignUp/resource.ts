import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
    name: 'preSignUp',
    resourceGroupName: 'auth',
    memoryMB: 256,
    timeoutSeconds: 10
});
