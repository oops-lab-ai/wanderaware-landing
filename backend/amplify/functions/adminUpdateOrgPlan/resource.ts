import { defineFunction } from '@aws-amplify/backend';

export const adminUpdateOrgPlan = defineFunction({
    entry: 'handler.ts',
    name: 'adminUpdateOrgPlan',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
