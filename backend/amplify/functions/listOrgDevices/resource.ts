import { defineFunction } from '@aws-amplify/backend';

export const listOrgDevices = defineFunction({
    entry: 'handler.ts',
    name: 'listOrgDevices',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
