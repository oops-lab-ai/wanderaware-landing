import { defineFunction } from '@aws-amplify/backend';

export const adminGrantOrg = defineFunction({
    entry: 'handler.ts',
    name: 'adminGrantOrg',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
