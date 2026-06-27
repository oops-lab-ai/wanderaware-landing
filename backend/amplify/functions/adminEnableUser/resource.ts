import { defineFunction } from '@aws-amplify/backend';

export const adminEnableUser = defineFunction({
    entry: 'handler.ts',
    name: 'adminEnableUser',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
