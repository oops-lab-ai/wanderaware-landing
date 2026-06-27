import type { PostAuthenticationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/postAuthentication';
import {
    CognitoIdentityProviderClient,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand,
    AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { Schema } from '../../data/resource';
import { generatedOrganizationName } from '../shared/organizationName';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const cognito = new CognitoIdentityProviderClient({});

// Source of truth for who's an admin: env var, comma-separated emails.
// Set ADMIN_EMAILS in Amplify Hosting → environment variables, redeploy.
// On every successful sign-in this trigger reconciles the caller's group membership
// against the env list, so adding/removing an admin is "edit env, redeploy" with
// no manual CLI commands. See docs/DESKTOP_SEAT_MANAGEMENT.md for the full pattern.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const handler: PostAuthenticationTriggerHandler = async (event) => {
    const { sub, email } = event.request.userAttributes;

    if (!sub || !email) return event;

    try {
        // Ensure Profile exists
        const existing = await client.models.Profile.get({ id: sub });
        if (!existing.data) {
            await client.models.Profile.create({
                id: sub,
                email,
                createdAt: new Date().toISOString(),
                newsLetter: true,
                owner: sub,
            });
            console.log(`[postAuthentication] Created missing Profile for ${sub}`);
        }

        // Ensure at least one Organization + Membership exists
        const memberships = await client.models.Membership.listMembershipByUserId({ userId: sub });
        if (!memberships.data || memberships.data.length === 0) {
            const org = await client.models.Organization.create({
                name: generatedOrganizationName(email.split('@')[0], "'s Organization"),
                ownerId: sub,
            });
            if (org.data) {
                await client.models.Membership.create({
                    userId: sub,
                    organizationId: org.data.id,
                    role: 'owner',
                });
                console.log(`[postAuthentication] Created missing Org ${org.data.id} + Membership for ${sub}`);
            }
        }
    } catch (error) {
        // Don't block login if provisioning fails — frontend fallback handles it
        console.error('[postAuthentication] Error provisioning user data:', error);
    }

    // ── Admin group reconciliation ───────────────────────────────────────────
    // Independent try/catch so a failure here NEVER blocks login. The user
    // signs in normally without the admin claim if anything goes wrong.
    try {
        const shouldBeAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

        const groupsResult = await cognito.send(
            new AdminListGroupsForUserCommand({
                UserPoolId: event.userPoolId,
                Username: event.userName,
            }),
        );
        const isCurrentlyAdmin = groupsResult.Groups?.some((g) => g.GroupName === 'admins') ?? false;

        if (shouldBeAdmin && !isCurrentlyAdmin) {
            await cognito.send(
                new AdminAddUserToGroupCommand({
                    UserPoolId: event.userPoolId,
                    Username: event.userName,
                    GroupName: 'admins',
                }),
            );
            console.log(`[postAuthentication] Added ${email} to admins group`);
        } else if (!shouldBeAdmin && isCurrentlyAdmin) {
            await cognito.send(
                new AdminRemoveUserFromGroupCommand({
                    UserPoolId: event.userPoolId,
                    Username: event.userName,
                    GroupName: 'admins',
                }),
            );
            console.log(`[postAuthentication] Removed ${email} from admins group`);
        }
    } catch (err) {
        console.error('[postAuthentication] Admin group sync failed:', err);
    }

    return event;
};
