import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { paymentProcessor } from './functions/stripe-functions/paymentProcessor/resource';
import { createCheckoutSession } from './functions/stripe-functions/createCheckoutSession/resource';
import { getProducts } from './functions/stripe-functions/getProducts/resource';
import { createBillingPortal } from './functions/stripe-functions/createBillingPortal/resource';
import { sendEmail } from './functions/sendEmail/resource';
import { sendContactForm } from './functions/sendContactForm/resource';
import { handleSesNotification } from './functions/handleSesNotification/resource';
import { listUserOrganizations } from './functions/listUserOrganizations/resource';
import { setupOrganization } from './functions/setupOrganization/resource';
import { listOrgMembers } from './functions/listOrgMembers/resource';
import { inviteMember } from './functions/inviteMember/resource';
import { getInvitationDetails } from './functions/getInvitationDetails/resource';
import { acceptInvitation } from './functions/acceptInvitation/resource';
import { declineInvitation } from './functions/declineInvitation/resource';
import { removeMember } from './functions/removeMember/resource';
import { updateMemberRole } from './functions/updateMemberRole/resource';
import { transferOwnership } from './functions/transferOwnership/resource';
import { fetchInvitations } from './functions/fetchInvitations/resource';
import { listMyInvitations } from './functions/listMyInvitations/resource';
import { leaveOrganization } from './functions/leaveOrganization/resource';
import { revokeInvitation } from './functions/revokeInvitation/resource';
import { endTrialEarly } from './functions/stripe-functions/endTrialEarly/resource';
import { createProducts } from './functions/stripe-functions/createProducts/resource';
import { claimDeviceCapacity } from './functions/claimDeviceCapacity/resource';
import { validateDeviceCapacity } from './functions/validateDeviceCapacity/resource';
import { releaseDevice } from './functions/releaseDevice/resource';
import { listOrgDevices } from './functions/listOrgDevices/resource';
import { getOrgUsage } from './functions/getOrgUsage/resource';
import { redeemPromoCode } from './functions/redeemPromoCode/resource';
import { adminListGrants } from './functions/adminListGrants/resource';
import { adminUpdateGrant } from './functions/adminUpdateGrant/resource';
import { adminGrantOrg } from './functions/adminGrantOrg/resource';
import { adminUpdateOrgPlan } from './functions/adminUpdateOrgPlan/resource';
import { adminListCodes } from './functions/adminListCodes/resource';
import { adminCreateCode } from './functions/adminCreateCode/resource';
import { adminRevokeCode } from './functions/adminRevokeCode/resource';
import { adminSearchUsers } from './functions/adminSearchUsers/resource';
import { adminGetUser } from './functions/adminGetUser/resource';
import { adminSearchOrgs } from './functions/adminSearchOrgs/resource';
import { adminGetOrg } from './functions/adminGetOrg/resource';
import { adminUpdateOrgMemberRole } from './functions/adminUpdateOrgMemberRole/resource';
import { adminRemoveOrgMember } from './functions/adminRemoveOrgMember/resource';
import { adminReleaseOrgDevice } from './functions/adminReleaseOrgDevice/resource';
import { adminRestoreOrg } from './functions/adminRestoreOrg/resource';
import { adminDisableUser } from './functions/adminDisableUser/resource';
import { adminEnableUser } from './functions/adminEnableUser/resource';
import { adminSignOutUser } from './functions/adminSignOutUser/resource';
import { adminResetUserPassword } from './functions/adminResetUserPassword/resource';
import { adminDeleteUser } from './functions/adminDeleteUser/resource';
import { getAuthMethods } from './functions/getAuthMethods/resource';
import { disconnectProvider } from './functions/disconnectProvider/resource';
import { CognitoLoginDomainStack } from './custom/cognitoLoginDomain';
import { DnsCoordinator, NamecheapEmailModule, SesEmailModule } from './custom/dns';
import { StripeWebhooksStack } from './custom/stripeWebhooks';
import { extractParentDomain } from './custom/shared/domainUtils';
import { EMAIL_CONSTANTS } from './custom/shared/emailConstants';

export const backend = defineBackend({
    auth,
    data,
    paymentProcessor,
    createCheckoutSession,
    getProducts,
    createBillingPortal,
    endTrialEarly,
    sendEmail,
    sendContactForm,
    handleSesNotification,
    listUserOrganizations,
    setupOrganization,
    listOrgMembers,
    inviteMember,
    getInvitationDetails,
    acceptInvitation,
    declineInvitation,
    removeMember,
    updateMemberRole,
    transferOwnership,
    fetchInvitations,
    listMyInvitations,
    leaveOrganization,
    revokeInvitation,
    createProducts,
    claimDeviceCapacity,
    validateDeviceCapacity,
    releaseDevice,
    listOrgDevices,
    getOrgUsage,
    redeemPromoCode,
    adminListGrants,
    adminUpdateGrant,
    adminGrantOrg,
    adminUpdateOrgPlan,
    adminListCodes,
    adminCreateCode,
    adminRevokeCode,
    adminSearchUsers,
    adminGetUser,
    adminSearchOrgs,
    adminGetOrg,
    adminUpdateOrgMemberRole,
    adminRemoveOrgMember,
    adminReleaseOrgDevice,
    adminRestoreOrg,
    adminDisableUser,
    adminEnableUser,
    adminSignOutUser,
    adminResetUserPassword,
    adminDeleteUser,
    getAuthMethods,
    disconnectProvider,
});

const sendEmailLambda = backend.sendEmail.resources.lambda;
const sendContactFormLambda = backend.sendContactForm.resources.lambda;

const customLoginDomain = process.env.CUSTOM_LOGIN_DOMAIN;
const hostedZoneId = process.env.ROUTE53_HOSTED_ZONE_ID;
const emailDkimValue = process.env.EMAIL_DKIM_VALUE;
const googleSiteVerificationPrefix = 'google-site-verification=';
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const googleSiteVerificationToken = googleSiteVerification?.startsWith(googleSiteVerificationPrefix)
    ? googleSiteVerification.slice(googleSiteVerificationPrefix.length).trim()
    : googleSiteVerification;
const buildEnv = process.env.BUILD_ENV;
if (!buildEnv) {
    throw new Error('BUILD_ENV is required. Set it in backend/.env before running the Amplify sandbox.');
}
const isProd = buildEnv === 'prod';

if (process.env.STRIPE_PARTNER_ID) {
    const stripeStack = new Stack(backend.stack, `StripeStack-${buildEnv}`);
    new StripeWebhooksStack(stripeStack, `StripeWebhookStack-${buildEnv}`, {
        backend,
    });
}

const resolvedCustomLoginDomain = hostedZoneId && isProd && customLoginDomain ? customLoginDomain : '';

if (hostedZoneId) {
    const emailDomain = process.env.EMAIL_DOMAIN || (customLoginDomain ? extractParentDomain(customLoginDomain) : 'wanderaware.com');

    const dns = new DnsCoordinator(backend.stack, `Dns-${buildEnv}`, {
        hostedZoneId,
        domainName: emailDomain,
    });

    if (isProd && googleSiteVerificationToken) {
        dns.addTxt('', [`${googleSiteVerificationPrefix}${googleSiteVerificationToken}`], 3600);
    }

    if (isProd && customLoginDomain) {
        new CognitoLoginDomainStack(backend.auth.stack, `CognitoLoginDomain-${buildEnv}`, {
            userPool: backend.auth.resources.userPool,
            loginFqdn: customLoginDomain,
            hostedZoneId,
        });
    }

    if (isProd && emailDkimValue) {
        new NamecheapEmailModule(backend.stack, `Namecheap-${buildEnv}`, {
            dns,
            dkimValue: emailDkimValue,
        });
    }

    const sesDomain = isProd ? 'wanderaware.com' : 'dev.wanderaware.com';
    const senderEmail = `noreply@${sesDomain}`;

    (sendEmailLambda as lambda.Function).addEnvironment('SENDER_EMAIL', senderEmail);

    const recipients = isProd ? EMAIL_CONSTANTS.PROD_RECIPIENTS : EMAIL_CONSTANTS.DEV_RECIPIENTS;
    (sendEmailLambda as lambda.Function).addEnvironment('RECIPIENT_EMAILS', recipients);
    (sendEmailLambda as lambda.Function).addEnvironment('CONTACT_EMAIL', EMAIL_CONSTANTS.CONTACT_EMAIL);

    const sesStack = new Stack(backend.stack, `SesStack-${buildEnv}`);

    const handleSesNotificationLambda = backend.handleSesNotification.resources.lambda;

    const sesMod = new SesEmailModule(sesStack, `Ses-${buildEnv}`, {
        hostedZoneId,
        domains: [
            {
                domain: sesDomain,
                mailFromSubdomain: 'mail',
            },
        ],
        notificationHandler: handleSesNotificationLambda as lambda.Function,
    });

    const configSetName = sesMod.getConfigurationSetName(sesDomain);
    (sendEmailLambda as lambda.Function).addEnvironment('SES_CONFIGURATION_SET_NAME', configSetName);

    sesMod.grantSendEmail(sendEmailLambda);

    sendEmailLambda.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        }),
    );

    // Wire sendContactForm Lambda with SES permissions
    (sendContactFormLambda as lambda.Function).addEnvironment('SENDER_EMAIL', senderEmail);
    (sendContactFormLambda as lambda.Function).addEnvironment('RECIPIENT_EMAILS', recipients);
    (sendContactFormLambda as lambda.Function).addEnvironment('CONTACT_EMAIL', EMAIL_CONSTANTS.CONTACT_EMAIL);
    (sendContactFormLambda as lambda.Function).addEnvironment('SES_CONFIGURATION_SET_NAME', configSetName);

    sesMod.grantSendEmail(sendContactFormLambda);

    sendContactFormLambda.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        }),
    );

    // Wire inviteMember Lambda with SES permissions
    const inviteMemberLambda = backend.inviteMember.resources.lambda;
    const frontendUrl = process.env.FRONTEND_URL || (isProd ? 'https://wanderaware.com' : 'https://dev.wanderaware.com');
    (inviteMemberLambda as lambda.Function).addEnvironment('SENDER_EMAIL', senderEmail);
    (inviteMemberLambda as lambda.Function).addEnvironment('SES_CONFIGURATION_SET_NAME', configSetName);
    (inviteMemberLambda as lambda.Function).addEnvironment('FRONTEND_URL', frontendUrl);

    sesMod.grantSendEmail(inviteMemberLambda);

    inviteMemberLambda.addToRolePolicy(
        new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'],
        }),
    );

    if (isProd) {
        dns.apply();
    }
}

// Wire accept/decline invitation Lambdas with Cognito AdminGetUser
const userPoolId = backend.auth.resources.userPool.userPoolId;
const userPoolArn = backend.auth.resources.userPool.userPoolArn;
const acceptLambda = backend.acceptInvitation.resources.lambda as lambda.Function;
const declineLambda = backend.declineInvitation.resources.lambda as lambda.Function;
const listMyInvitationsLambda = backend.listMyInvitations.resources.lambda as lambda.Function;

acceptLambda.addEnvironment('USER_POOL_ID', userPoolId);
declineLambda.addEnvironment('USER_POOL_ID', userPoolId);
listMyInvitationsLambda.addEnvironment('USER_POOL_ID', userPoolId);
acceptLambda.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [userPoolArn] }));
declineLambda.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [userPoolArn] }));
listMyInvitationsLambda.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminGetUser'], resources: [userPoolArn] }));

// Wire preSignUp trigger with Cognito permissions for account linking.
// We use 'arn:aws:cognito-idp:*:*:userpool/*' to avoid a circular dependency
// between the user pool and the preSignUp trigger Lambda within the auth stack.
const authStack = backend.auth.resources.userPool.stack;
const preSignUpFn = authStack.node.findAll().find((c) => c.node.id.includes('preSignUp') && 'addToRolePolicy' in c) as lambda.Function | undefined;
if (preSignUpFn) {
    preSignUpFn.addToRolePolicy(
        new iam.PolicyStatement({
            actions: [
                'cognito-idp:AdminLinkProviderForUser',
                'cognito-idp:ListUsers',
                // AdminDeleteUser is for the UNCONFIRMED-orphan sweep in preSignUp/handler.ts:
                // a native shell with the same email blocks the federated link, so the handler
                // deletes it before AdminLinkProviderForUser. Scoped to the user pool only.
                'cognito-idp:AdminDeleteUser',
                // AdminCreateUser + AdminSetUserPassword power the "create native shell at
                // first federated sign-in" branch. Every user in this pool is a native user
                // (UUID Username) — federated identities are always linked into a native
                // profile. See preSignUp/handler.ts branch 3 for the full rationale.
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminSetUserPassword',
            ],
            resources: ['arn:aws:cognito-idp:*:*:userpool/*'],
        }),
    );
}

// Wire postAuthentication trigger with Cognito group management permissions.
// On every successful sign-in, this Lambda reconciles admin group membership
// against the ADMIN_EMAILS env var (set in Amplify Hosting). Same circular-dependency
// workaround as preSignUp above — wildcard userpool ARN.
const postAuthFn = authStack.node.findAll().find((c) => c.node.id.includes('postAuthentication') && 'addToRolePolicy' in c) as lambda.Function | undefined;
if (postAuthFn) {
    postAuthFn.addToRolePolicy(
        new iam.PolicyStatement({
            actions: [
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
                'cognito-idp:AdminListGroupsForUser',
            ],
            resources: ['arn:aws:cognito-idp:*:*:userpool/*'],
        }),
    );
}

// Wire admin user-management Lambdas with Cognito admin IAM + USER_POOL_ID.
// Same wildcard-ARN pattern as postAuth/preSignUp to avoid the auth-stack
// circular dependency. The new user-action Lambdas (disable/enable/sign-out/
// reset/delete) need mutation permissions; the enriched adminGetUser and
// adminSearchUsers only need read permissions (AdminGetUser/ListUsers) so
// they can join Cognito status onto their responses.
const cognitoUserPoolWildcardArn = 'arn:aws:cognito-idp:*:*:userpool/*';

const adminUserActionLambdas: lambda.Function[] = [
    backend.adminDisableUser.resources.lambda as lambda.Function,
    backend.adminEnableUser.resources.lambda as lambda.Function,
    backend.adminSignOutUser.resources.lambda as lambda.Function,
    backend.adminResetUserPassword.resources.lambda as lambda.Function,
    backend.adminDeleteUser.resources.lambda as lambda.Function,
];

for (const fn of adminUserActionLambdas) {
    fn.addEnvironment('USER_POOL_ID', userPoolId);
    fn.addToRolePolicy(
        new iam.PolicyStatement({
            actions: [
                'cognito-idp:AdminDisableUser',
                'cognito-idp:AdminEnableUser',
                'cognito-idp:AdminUserGlobalSignOut',
                'cognito-idp:AdminResetUserPassword',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:AdminGetUser',
            ],
            resources: [cognitoUserPoolWildcardArn],
        }),
    );
}

// Enriched read paths — need AdminGetUser and ListUsers to join Cognito
// status onto the existing data-client responses.
const adminGetUserLambda = backend.adminGetUser.resources.lambda as lambda.Function;
adminGetUserLambda.addEnvironment('USER_POOL_ID', userPoolId);
adminGetUserLambda.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ['cognito-idp:AdminGetUser'],
        resources: [cognitoUserPoolWildcardArn],
    }),
);

const adminSearchUsersLambda = backend.adminSearchUsers.resources.lambda as lambda.Function;
adminSearchUsersLambda.addEnvironment('USER_POOL_ID', userPoolId);
adminSearchUsersLambda.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminGetUser'],
        resources: [cognitoUserPoolWildcardArn],
    }),
);

// All other functions (acceptInvitation, declineInvitation, transferOwnership, etc.)
// use the Amplify Data client — no manual DynamoDB wiring needed.
// Access is granted via allow.resource() in the data schema.

// Set TTL on Invitation table for auto-cleanup of expired invites
const cfnTables = backend.data.resources.cfnResources.amplifyDynamoDbTables;
cfnTables['Invitation'].timeToLiveAttribute = {
    attributeName: 'ttl',
    enabled: true,
};

// Wire Connected Accounts Lambdas — getAuthMethods reads `identities` from the
// native user; disconnectProvider sets a new password before AdminDisableProvider
// so the native user always has a working sign-in method after the unlink.
// Same wildcard-ARN pattern as preSignUp/postAuth to avoid the auth-stack
// circular dependency.
const getAuthMethodsLambda = backend.getAuthMethods.resources.lambda as lambda.Function;
getAuthMethodsLambda.addEnvironment('USER_POOL_ID', userPoolId);
getAuthMethodsLambda.addToRolePolicy(
    new iam.PolicyStatement({
        actions: ['cognito-idp:AdminGetUser'],
        resources: [cognitoUserPoolWildcardArn],
    }),
);

const disconnectProviderLambda = backend.disconnectProvider.resources.lambda as lambda.Function;
disconnectProviderLambda.addEnvironment('USER_POOL_ID', userPoolId);
disconnectProviderLambda.addToRolePolicy(
    new iam.PolicyStatement({
        actions: [
            'cognito-idp:AdminGetUser',
            'cognito-idp:AdminDisableProviderForUser',
            'cognito-idp:AdminSetUserPassword',
        ],
        resources: [cognitoUserPoolWildcardArn],
    }),
);


backend.addOutput({
    custom: {
        customLoginDomain: resolvedCustomLoginDomain,
        buildEnv,
    },
});
