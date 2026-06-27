import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/postConfirmation';
import { Schema } from '../../data/resource';
import { generatedOrganizationName } from '../shared/organizationName';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: PostConfirmationTriggerHandler = async (event) => {
    console.log(JSON.stringify(event));

    // Only provision on signup confirmation, not password reset confirmation
    if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
        return event;
    }

    try {
        const { sub, email } = event.request.userAttributes;
        const profileId = sub;

        console.log(`PostConfirmation triggered for user ${sub} with email ${email}`);

        // Check if this profile already exists
        const existing = await client.models.Profile.get({ id: profileId });
        console.log('Existing profile check:', { exists: !!existing.data, profileId });

        if (!existing.data) {
            const profile = await client.models.Profile.create({
                id: profileId,
                email: email,
                createdAt: new Date().toISOString(),
                // GDPR Art. 7 / CAN-SPAM: marketing communications default to opt-OUT.
                // The Settings page lets the user opt in any time.
                newsLetter: false,
                // Trial eligibility gate. False until paymentProcessor flips it to true
                // on the user's first trialing subscription (anywhere — across all their orgs).
                hasUsedTrial: false,
                owner: profileId
            });
            console.log(`Profile created for user ${sub}:`, {
                profileId,
                email,
                success: !!profile.data
            });
        } else {
            console.log(`Profile already exists for user ${sub}`);
        }

        // Ensure Organization + Membership exist for the new user
        const existingMemberships = await client.models.Membership.listMembershipByUserId({ userId: profileId });
        if (!existingMemberships.data || existingMemberships.data.length === 0) {
            console.log(`Creating Organization + Membership for user ${sub}`);
            try {
                const org = await client.models.Organization.create({
                    name: generatedOrganizationName(email.split('@')[0], "'s Organization"),
                    ownerId: profileId
                });
                if (org.data) {
                    await client.models.Membership.create({
                        userId: profileId,
                        organizationId: org.data.id,
                        role: 'owner'
                    });
                    console.log(`Organization ${org.data.id} and Membership created for user ${sub}`);
                }
            } catch (orgError) {
                console.error(`Error creating Organization for user ${sub}:`, orgError);
                throw orgError; // Re-throw so Cognito can retry
            }
        } else {
            console.log(`Membership already exists for user ${sub}`);
        }

        return event;
    } catch (error) {
        console.error('Error in postConfirmation:', error);
        throw error;
    }
};
