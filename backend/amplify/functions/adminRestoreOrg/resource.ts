import { defineFunction } from '@aws-amplify/backend';

export const adminRestoreOrg = defineFunction({
    entry: 'handler.ts',
    name: 'adminRestoreOrg',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
