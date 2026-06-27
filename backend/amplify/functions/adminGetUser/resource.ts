import { defineFunction } from '@aws-amplify/backend';

export const adminGetUser = defineFunction({
    entry: 'handler.ts',
    name: 'adminGetUser',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
