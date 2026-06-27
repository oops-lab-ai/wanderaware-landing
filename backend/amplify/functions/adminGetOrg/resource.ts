import { defineFunction } from '@aws-amplify/backend';

export const adminGetOrg = defineFunction({
    entry: 'handler.ts',
    name: 'adminGetOrg',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
