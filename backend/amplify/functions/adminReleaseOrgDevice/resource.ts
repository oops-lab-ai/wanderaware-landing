import { defineFunction } from '@aws-amplify/backend';

export const adminReleaseOrgDevice = defineFunction({
    entry: 'handler.ts',
    name: 'adminReleaseOrgDevice',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
