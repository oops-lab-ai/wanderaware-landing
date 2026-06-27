import { defineFunction } from '@aws-amplify/backend';

export const inviteMember = defineFunction({
    entry: 'handler.ts',
    name: 'inviteMember',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
