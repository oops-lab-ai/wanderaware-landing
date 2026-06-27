import type { PreSignUpTriggerHandler } from 'aws-lambda';
import {
    CognitoIdentityProviderClient,
    AdminDeleteUserCommand,
    AdminLinkProviderForUserCommand,
    ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

// Cognito userName format for federated sign-ups: <provider-prefix>_<idp-user-id>.
// The prefix is lowercased by Cognito, but AdminLinkProviderForUser's
// SourceUser.ProviderName must EXACTLY match the registered IdP name in the user pool.
// Add new entries here whenever you wire a new external provider in
// backend/amplify/auth/resource.ts.
const PROVIDER_NAME_BY_PREFIX: Record<string, string> = {
    google: 'Google',
    facebook: 'Facebook',
    signinwithapple: 'SignInWithApple',
    loginwithamazon: 'LoginWithAmazon',
};

export const handler: PreSignUpTriggerHandler = async (event) => {
    if (event.triggerSource !== 'PreSignUp_ExternalProvider') return event;

    const email = event.request.userAttributes.email;
    const emailVerified = event.request.userAttributes.email_verified;
    // Refuse to link unverified emails — protects against IdPs that don't verify
    // (Workspace SAML, future providers).
    if (!email || emailVerified !== 'true') return event;

    const emailLower = email.toLowerCase();

    // ListUsers `=` filter is case-sensitive; `^=` is case-insensitive prefix-match
    // (per AWS docs). A native user signed up as `Imatlak03@gmail.com` would never be
    // found when Google sends back `imatlak03@gmail.com` with the `=` filter, and the
    // linker would silently create a second federated user — user gets logged into
    // the wrong account. Verify exact equality in JS after the prefix match.
    const lookup = await cognito.send(new ListUsersCommand({
        UserPoolId: event.userPoolId,
        Filter: `email ^= "${emailLower}"`,
        Limit: 10,
    }));
    const exactEmailMatches = (lookup.Users ?? []).filter((u) => {
        const userEmail = u.Attributes?.find((a) => a.Name === 'email')?.Value?.toLowerCase();
        return userEmail === emailLower;
    });

    // Orphan sweep — UNCONFIRMED native shells (someone started email/password sign-up,
    // got the verification code email, never confirmed) hold the email alias slot. That
    // collision blocks Cognito from attaching the new federated identity to anything,
    // and the user lands in a broken half-federated half-orphan state. UNCONFIRMED users
    // never ran postConfirmation, so no Profile/Org exists — deletion is safe. Federated
    // users (Username has '_') are left alone; only native shells are swept.
    const orphans = exactEmailMatches.filter((u) => {
        const isFederated = u.Username?.includes('_') ?? false;
        return !isFederated && u.UserStatus === 'UNCONFIRMED';
    });
    for (const orphan of orphans) {
        if (!orphan.Username) continue;
        try {
            await cognito.send(new AdminDeleteUserCommand({
                UserPoolId: event.userPoolId,
                Username: orphan.Username,
            }));
            console.log(`[preSignUp] deleted UNCONFIRMED orphan ${orphan.Username} (${emailLower})`);
        } catch (err) {
            console.error(`[preSignUp] failed to delete orphan ${orphan.Username}:`, err);
            // Don't abort — proceed to link if a CONFIRMED user is also present.
        }
    }

    const localUser = exactEmailMatches.find((u) => {
        const isFederated = u.Username?.includes('_') ?? false;
        return !isFederated && u.UserStatus === 'CONFIRMED';
    });

    if (localUser?.Username) {
        const sepIdx = event.userName.indexOf('_');
        if (sepIdx > 0) {
            const prefix = event.userName.slice(0, sepIdx).toLowerCase();
            const providerName = PROVIDER_NAME_BY_PREFIX[prefix];
            const providerUserId = event.userName.slice(sepIdx + 1);
            if (providerName && providerUserId) {
                try {
                    await cognito.send(new AdminLinkProviderForUserCommand({
                        UserPoolId: event.userPoolId,
                        DestinationUser: {
                            ProviderName: 'Cognito',
                            ProviderAttributeValue: localUser.Username,
                        },
                        SourceUser: {
                            ProviderName: providerName,
                            ProviderAttributeName: 'Cognito_Subject',
                            ProviderAttributeValue: providerUserId,
                        },
                    }));
                } catch (err: unknown) {
                    // Two devices triggering simultaneous merges — already linked, no-op.
                    if ((err as { name?: string }).name !== 'UserAlreadyLinkedException') throw err;
                }
            } else {
                console.log(`[preSignUp] unknown provider prefix '${prefix}', skipping link`);
            }
        }
    }

    // Auto-confirm runs whether or not we linked, so brand-new federated users
    // (no native account at this email) don't get stuck UNCONFIRMED.
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
};
