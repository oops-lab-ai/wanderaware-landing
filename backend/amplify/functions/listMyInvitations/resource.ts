import { defineFunction } from '@aws-amplify/backend';

export const listMyInvitations = defineFunction({
    entry: 'handler.ts',
    name: 'listMyInvitations',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
