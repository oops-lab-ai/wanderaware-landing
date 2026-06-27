import { defineFunction } from '@aws-amplify/backend';

export const removeMember = defineFunction({
    entry: 'handler.ts',
    name: 'removeMember',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
