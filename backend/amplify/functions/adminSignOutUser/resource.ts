import { defineFunction } from '@aws-amplify/backend';

export const adminSignOutUser = defineFunction({
    entry: 'handler.ts',
    name: 'adminSignOutUser',
    resourceGroupName: 'data',
    timeoutSeconds: 15,
});
