import { defineFunction } from '@aws-amplify/backend';

export const adminResetUserPassword = defineFunction({
    entry: 'handler.ts',
    name: 'adminResetUserPassword',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
