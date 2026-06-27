import { defineFunction } from '@aws-amplify/backend';

export const leaveOrganization = defineFunction({
    entry: 'handler.ts',
    name: 'leaveOrganization',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
