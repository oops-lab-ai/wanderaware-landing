import { defineFunction } from '@aws-amplify/backend';

export const adminRemoveOrgMember = defineFunction({
    entry: 'handler.ts',
    name: 'adminRemoveOrgMember',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
