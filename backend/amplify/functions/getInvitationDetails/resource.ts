import { defineFunction } from '@aws-amplify/backend';

export const getInvitationDetails = defineFunction({
    entry: 'handler.ts',
    name: 'getInvitationDetails',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
