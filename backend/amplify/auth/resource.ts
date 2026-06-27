import { defineAuth, secret } from '@aws-amplify/backend';
import { customMessage } from '../functions/customMessage/resource';
import { postAuthentication } from '../functions/postAuthentication/resource';
import { postConfirmation } from '../functions/postConfirmation/resource';
import { preSignUp } from '../functions/preSignUp/resource';

const webAppUrl = process.env.WEB_APP_URL || 'https://wanderaware.com';
const devWebAppUrl = process.env.DEV_WEB_APP_URL || 'https://dev.wanderaware.com';
const localWebAppUrl = process.env.LOCAL_WEB_APP_URL || 'http://localhost:4321';
const buildEnv = process.env.BUILD_ENV;

if (!buildEnv) {
    throw new Error('BUILD_ENV is required. Set it in backend/.env before running the Amplify sandbox.');
}

export const auth = defineAuth({
    name: `wanderaware-${buildEnv}`,
    triggers: {
        postAuthentication,
        preSignUp,
        postConfirmation,
        customMessage,
    },
    groups: ['admins'],
    loginWith: {
        email: true,
        externalProviders: {
            google: {
                clientId: secret('GOOGLE_CLIENT_ID'),
                clientSecret: secret('GOOGLE_CLIENT_SECRET'),
                scopes: ['profile', 'email', 'openid'],
                attributeMapping: {
                    email: 'email',
                    emailVerified: 'email_verified',
                    fullname: 'name',
                },
            },
            callbackUrls: [`${localWebAppUrl}/dashboard`, `${devWebAppUrl}/dashboard`, `${webAppUrl}/dashboard`],
            logoutUrls: [localWebAppUrl, devWebAppUrl, webAppUrl],
        },
    },
});
