import { defineFunction } from '@aws-amplify/backend';

export const setupOrganization = defineFunction({
    entry: 'handler.ts',
    name: 'setupOrganization',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
