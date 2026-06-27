import { defineFunction } from '@aws-amplify/backend';

export const adminSearchOrgs = defineFunction({
    entry: 'handler.ts',
    name: 'adminSearchOrgs',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
