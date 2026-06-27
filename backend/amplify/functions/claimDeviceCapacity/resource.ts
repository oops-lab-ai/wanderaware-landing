import { defineFunction } from '@aws-amplify/backend';

export const claimDeviceCapacity = defineFunction({
    name: 'claimDeviceCapacity',
    resourceGroupName: 'data',
});
