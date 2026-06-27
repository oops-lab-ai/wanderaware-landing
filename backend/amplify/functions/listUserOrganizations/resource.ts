import { defineFunction } from '@aws-amplify/backend';

export const listUserOrganizations = defineFunction({
    entry: 'handler.ts',
    name: 'listUserOrganizations',
    resourceGroupName: 'data',
    timeoutSeconds: 10
});
