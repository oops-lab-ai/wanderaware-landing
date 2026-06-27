import { defineFunction } from '@aws-amplify/backend';

export const adminListGrants = defineFunction({
    entry: 'handler.ts',
    name: 'adminListGrants',
    resourceGroupName: 'data',
    timeoutSeconds: 15
});
