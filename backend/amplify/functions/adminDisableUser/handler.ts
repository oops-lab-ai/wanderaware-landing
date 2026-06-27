import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminDisableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Blocks a user's login without deleting any data. They stay in Cognito, keep
 * their Profile/Memberships/etc., but every future sign-in attempt fails with
 * "User is disabled". Reversible via AdminEnableUser. Use for: suspensions,
 * policy violations pending review, accounts compromised by stolen credentials.
 */
export const handler: Schema['AdminDisableUser']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);
    const { userId } = event.arguments;

    try {
        await cognito.send(new AdminDisableUserCommand({
            UserPoolId: process.env.USER_POOL_ID!,
            Username: userId, // Cognito admin APIs accept sub as Username
        }));
        console.log(`[adminDisableUser] Disabled ${userId}`);
        return { success: true, message: 'User disabled' };
    } catch (err: any) {
        console.error('[adminDisableUser] Failed:', err);
        return { success: false, message: err?.message ?? 'Failed to disable user' };
    }
};
