import { defineFunction } from '@aws-amplify/backend';

export const listOrgMembers = defineFunction({
    entry: 'handler.ts',
    name: 'listOrgMembers',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
