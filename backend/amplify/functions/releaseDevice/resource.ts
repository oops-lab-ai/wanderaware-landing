import { defineFunction } from '@aws-amplify/backend';

export const releaseDevice = defineFunction({
    name: 'releaseDevice',
    resourceGroupName: 'data',
});
