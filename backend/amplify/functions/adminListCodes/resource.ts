import { defineFunction } from '@aws-amplify/backend';

export const adminListCodes = defineFunction({
    entry: 'handler.ts',
    name: 'adminListCodes',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
