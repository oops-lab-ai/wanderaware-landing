import { defineFunction } from '@aws-amplify/backend';

export const updateMemberRole = defineFunction({
    entry: 'handler.ts',
    name: 'updateMemberRole',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
