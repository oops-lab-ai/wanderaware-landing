import { defineFunction } from '@aws-amplify/backend';

export const adminDeleteUser = defineFunction({
    entry: 'handler.ts',
    name: 'adminDeleteUser',
    resourceGroupName: 'data',
    // Higher timeout — this Lambda scans memberships, deletes them one by one,
    // releases device activations, and finally deletes the Cognito user.
    timeoutSeconds: 30,
    memoryMB: 512,
});
