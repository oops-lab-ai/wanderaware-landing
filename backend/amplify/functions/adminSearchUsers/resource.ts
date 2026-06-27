import { defineFunction } from '@aws-amplify/backend';

export const adminSearchUsers = defineFunction({
    entry: 'handler.ts',
    name: 'adminSearchUsers',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
