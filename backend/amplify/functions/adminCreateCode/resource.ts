import { defineFunction } from '@aws-amplify/backend';

export const adminCreateCode = defineFunction({
    entry: 'handler.ts',
    name: 'adminCreateCode',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
