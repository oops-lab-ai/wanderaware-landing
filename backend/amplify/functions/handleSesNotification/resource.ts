import { defineFunction } from '@aws-amplify/backend';

export const handleSesNotification = defineFunction({
    entry: 'handler.ts',
    name: 'handleSesNotification',
    resourceGroupName: 'data',
    timeoutSeconds: 30, // Allow time for multiple DynamoDB writes
    memoryMB: 256 // Minimal memory for cost efficiency
});
