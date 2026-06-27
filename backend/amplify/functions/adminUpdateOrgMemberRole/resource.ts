import { defineFunction } from '@aws-amplify/backend';

export const adminUpdateOrgMemberRole = defineFunction({
    entry: 'handler.ts',
    name: 'adminUpdateOrgMemberRole',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
