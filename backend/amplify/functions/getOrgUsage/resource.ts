import { defineFunction } from '@aws-amplify/backend';

export const getOrgUsage = defineFunction({
    entry: 'handler.ts',
    name: 'getOrgUsage',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
