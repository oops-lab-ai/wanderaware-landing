import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminResetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Forces a user into the RESET_REQUIRED state. Their existing password stops
 * working immediately and Cognito fires the standard ForgotPassword email
 * flow (via the configured customMessage trigger) so they can set a new one.
 *
 * Use for: account recovery, forgotten password requests made via support,
 * credential rotation after a suspected compromise.
 */
export const handler: Schema['AdminResetUserPassword']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);
    const { userId } = event.arguments;

    try {
        await cognito.send(new AdminResetUserPasswordCommand({
            UserPoolId: process.env.USER_POOL_ID!,
            Username: userId,
        }));
        console.log(`[adminResetUserPassword] Reset requested for ${userId}`);
        return { success: true, message: 'Password reset email sent' };
    } catch (err: any) {
        console.error('[adminResetUserPassword] Failed:', err);
        return { success: false, message: err?.message ?? 'Failed to reset password' };
    }
};
