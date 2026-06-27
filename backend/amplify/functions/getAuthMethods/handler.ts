import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Schema } from '../../data/resource';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Reports the caller's currently-active sign-in methods. The settings UI uses
 * this to decide whether to show the Disconnect Google button.
 *
 * Every user is native (PreSignUp guarantees this — see preSignUp/handler.ts).
 * Federated identities are linked into native profiles, so the only thing that
 * varies between users is which providers are linked.
 */
export const handler: Schema['GetAuthMethods']['functionHandler'] = async (event): Promise<any> => {
    const userId = (event as any).identity?.sub as string | undefined;
    if (!userId) {
        return { linkedProviders: [] };
    }

    const result = await cognito.send(new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: userId,
    }));

    const identitiesAttr = result.UserAttributes?.find((a) => a.Name === 'identities')?.Value;
    let identities: Array<{ providerName?: string }> = [];
    if (identitiesAttr) {
        try {
            identities = JSON.parse(identitiesAttr);
        } catch {
            // Malformed identities — treat as none rather than crash.
        }
    }
    const linkedProviders = identities
        .map((i) => i.providerName)
        .filter((n): n is string => !!n);

    return { linkedProviders };
};
