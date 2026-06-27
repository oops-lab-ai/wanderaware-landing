import { defineFunction } from '@aws-amplify/backend';

export const adminRevokeCode = defineFunction({
    entry: 'handler.ts',
    name: 'adminRevokeCode',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
