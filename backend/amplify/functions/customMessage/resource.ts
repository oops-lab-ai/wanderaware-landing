import { defineFunction } from '@aws-amplify/backend-function';

export const customMessage = defineFunction({
    entry: './handler.ts',
    name: 'customMessage',
    resourceGroupName: 'auth'
});
