import { defineFunction } from '@aws-amplify/backend';

export const adminUpdateGrant = defineFunction({
    entry: 'handler.ts',
    name: 'adminUpdateGrant',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
