import { defineFunction } from '@aws-amplify/backend';

export const validateDeviceCapacity = defineFunction({
    name: 'validateDeviceCapacity',
    resourceGroupName: 'data',
});
