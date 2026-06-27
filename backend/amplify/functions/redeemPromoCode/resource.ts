import { defineFunction } from '@aws-amplify/backend';

export const redeemPromoCode = defineFunction({
    entry: 'handler.ts',
    name: 'redeemPromoCode',
    resourceGroupName: 'data',
    timeoutSeconds: 15
});
