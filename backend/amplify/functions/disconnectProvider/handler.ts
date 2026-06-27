import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminDisableProviderForUserCommand,
    AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Schema } from '../../data/resource';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Disconnect a federated provider (Google) from the caller's native account.
 *
 * Every user in this pool is a native user with a Cognito password (set in
 * preSignUp/handler.ts when the native shell was created). The "password" is
 * either one the user knows (native sign-up, forgot-password reset) or the
 * server-generated random one PreSignUp issued for Google-first sign-ups.
 *
 * Because we can't tell from Cognito alone which kind it is, we always require
 * a fresh newPassword on disconnect. The user types one — Cognito accepts it
 * (re-typing the same password is a no-op rewrite, no error). After this:
 *
 *   - AdminSetUserPassword puts the chosen password on the native user record
 *   - AdminDisableProviderForUser severs the Google link from the identities
 *     attribute. The native user remains; sign-in via email + the new password
 *     works immediately.
 *
 * Re-adding Google later: user signs out, clicks "Sign in with Google" — the
 * preSignUp same-email auto-linker re-attaches it silently.
 *
 * Note: this is AdminSetUserPassword on a NATIVE user (UUID Username,
 * UserStatus = CONFIRMED), which AWS supports. AWS specifically discourages
 * setting passwords on EXTERNAL_PROVIDER federated user profiles ("google_<sub>"
 * Username) — those don't exist in this pool because PreSignUp creates a
 * native shell + links the federated identity into it.
 */
export const handler: Schema['DisconnectProvider']['functionHandler'] = async (event): Promise<any> => {
    const userId = (event as any).identity?.sub as string | undefined;
    if (!userId) {
        return { success: false, message: 'Unauthorized' };
    }

    const { providerName, newPassword } = event.arguments as {
        providerName: string;
        newPassword: string;
    };

    if (!newPassword) {
        return { success: false, message: 'A new password is required to disconnect.' };
    }

    const adminGet = await cognito.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: userId,
    }));

    const identitiesAttr = adminGet.UserAttributes?.find((a) => a.Name === 'identities')?.Value;
    let identities: Array<{ providerName?: string; userId?: string }> = [];
    try {
        identities = identitiesAttr ? JSON.parse(identitiesAttr) : [];
    } catch {
        identities = [];
    }

    const target = identities.find((i) => i.providerName === providerName);
    if (!target?.userId) {
        return { success: false, message: `${providerName} is not connected to this account` };
    }

    // Set the password before unlinking. If unlink fails after, the user still
    // has the new password as a working sign-in method — they can retry the
    // disconnect from the same UI. Worst case: extra password set.
    await cognito.send(new AdminSetUserPasswordCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: userId,
        Password: newPassword,
        Permanent: true,
    }));

    await cognito.send(new AdminDisableProviderForUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        User: {
            ProviderName: providerName,
            ProviderAttributeName: 'Cognito_Subject',
            ProviderAttributeValue: target.userId,
        },
    }));

    return {
        success: true,
        message: `${providerName} disconnected.`,
    };
};
