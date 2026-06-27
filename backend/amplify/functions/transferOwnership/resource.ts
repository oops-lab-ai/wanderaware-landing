import { defineFunction } from '@aws-amplify/backend';

export const transferOwnership = defineFunction({
    entry: 'handler.ts',
    name: 'transferOwnership',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
