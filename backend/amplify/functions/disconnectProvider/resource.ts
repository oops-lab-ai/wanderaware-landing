import { defineFunction } from '@aws-amplify/backend';

export const disconnectProvider = defineFunction({
    entry: './handler.ts',
    name: 'disconnectProvider',
    resourceGroupName: 'data',
    timeoutSeconds: 15,
});
