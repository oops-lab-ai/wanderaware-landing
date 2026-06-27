import { defineFunction } from '@aws-amplify/backend';

export const declineInvitation = defineFunction({
    entry: 'handler.ts',
    name: 'declineInvitation',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
