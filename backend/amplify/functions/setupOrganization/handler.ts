import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/setupOrganization';
import { Schema } from '../../data/resource';
import { normalizeOrganizationName } from '../shared/organizationName';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['SetupOrganization']['functionHandler'] = async (event) => {
    const { name } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Create organization
    const orgResult = await client.models.Organization.create({
        name: normalizeOrganizationName(name),
        ownerId: callerId
    });
    const org = orgResult.data;

    if (!org) {
        throw new Error('Failed to create organization');
    }

    // Create owner membership with orphan cleanup on failure
    try {
        const membershipResult = await client.models.Membership.create({
            userId: callerId,
            organizationId: org.id,
            role: 'owner'
        });
        return { organizationId: org.id, membershipId: membershipResult.data?.id ?? null };
    } catch (error) {
        console.error('Membership creation failed, cleaning up orphan org:', error);
        try {
            await client.models.Organization.delete({ id: org.id });
        } catch (cleanupError) {
            console.error('Failed to clean up orphan org:', cleanupError);
        }
        throw error;
    }
};
