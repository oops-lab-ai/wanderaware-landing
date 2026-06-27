import { defineFunction } from '@aws-amplify/backend';

export const acceptInvitation = defineFunction({
    entry: 'handler.ts',
    name: 'acceptInvitation',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
