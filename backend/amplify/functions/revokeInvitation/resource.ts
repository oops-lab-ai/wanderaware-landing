import { defineFunction } from '@aws-amplify/backend';

export const revokeInvitation = defineFunction({
    entry: 'handler.ts',
    name: 'revokeInvitation',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
