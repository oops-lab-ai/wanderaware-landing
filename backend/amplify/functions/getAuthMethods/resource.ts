import { defineFunction } from '@aws-amplify/backend';

export const getAuthMethods = defineFunction({
    entry: './handler.ts',
    name: 'getAuthMethods',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
