import { defineFunction } from '@aws-amplify/backend';

// USER_POOL_ID is wired from backend.ts via addEnvironment() to avoid the
// circular dependency that occurs when a data-stack Lambda reads from the
// auth stack at synth time. See backend.ts for the IAM policy grant.
export const adminDisableUser = defineFunction({
    entry: 'handler.ts',
    name: 'adminDisableUser',
    resourceGroupName: 'data',
    timeoutSeconds: 10,
});
