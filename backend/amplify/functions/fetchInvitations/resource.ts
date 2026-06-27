import { defineFunction } from '@aws-amplify/backend';

export const fetchInvitations = defineFunction({
    entry: 'handler.ts',
    name: 'fetchInvitations',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
