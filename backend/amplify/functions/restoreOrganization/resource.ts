import { defineFunction } from '@aws-amplify/backend';

export const restoreOrganization = defineFunction({
    name: 'restoreOrganization',
    resourceGroupName: 'data'
});
