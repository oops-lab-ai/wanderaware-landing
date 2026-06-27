import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminEnableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Re-enables a previously disabled user so they can sign in again. The inverse
 * of adminDisableUser. All their data is intact — this just flips the Enabled
 * flag on the Cognito user.
 */
export const handler: Schema['AdminEnableUser']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);
    const { userId } = event.arguments;

    try {
        await cognito.send(new AdminEnableUserCommand({
            UserPoolId: process.env.USER_POOL_ID!,
            Username: userId,
        }));
        console.log(`[adminEnableUser] Enabled ${userId}`);
        return { success: true, message: 'User enabled' };
    } catch (err: any) {
        console.error('[adminEnableUser] Failed:', err);
        return { success: false, message: err?.message ?? 'Failed to enable user' };
    }
};
