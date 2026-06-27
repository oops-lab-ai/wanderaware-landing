import { defineFunction } from '@aws-amplify/backend-function';

// Define the payment processor function
export const postConfirmation = defineFunction({
    entry: './handler.ts',
    name: `postConfirmation`,
    resourceGroupName: 'auth'
});
