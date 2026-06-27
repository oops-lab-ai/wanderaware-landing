import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminSignOutUser';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';
import {
    CognitoIdentityProviderClient,
    AdminUserGlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();
const cognito = new CognitoIdentityProviderClient({});

/**
 * Invalidates every refresh token for a user — all active sessions (web,
 * web, mobile) get kicked out on their next token refresh. We also cascade
 * delete the user's DeviceActivation rows so device capacity are freed and the
 * user needs to go through claimDeviceCapacity again on next login.
 *
 * Use for: compromised accounts, forced re-authentication after a policy
 * change, ejecting a user from all active web installs before an
 * investigation.
 */
export const handler: Schema['AdminSignOutUser']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);
    const { userId } = event.arguments;

    try {
        // 1. Cognito global sign-out — invalidates refresh tokens immediately.
        //    Access tokens remain valid until their TTL expires (default 1h)
        //    but they can't be refreshed, so sessions die within that window.
        await cognito.send(new AdminUserGlobalSignOutCommand({
            UserPoolId: process.env.USER_POOL_ID!,
            Username: userId,
        }));

        // 2. Cascade release device capacity. Without this, the WanderAware dashboard would
        //    keep running against its cached refresh-token until validateDeviceCapacity
        //    next checks — and even then the seat row would still be there until
        //    some other cleanup path removed it.
        const devices = await client.models.DeviceActivation.list({
            filter: { userId: { eq: userId } },
        });
        let released = 0;
        for (const d of devices.data ?? []) {
            await client.models.DeviceActivation.delete({
                userId: d.userId,
                deviceId: d.deviceId,
            });
            released++;
        }

        console.log(`[adminSignOutUser] Signed out ${userId}, released ${released} device slot(s)`);
        return { success: true, message: `User signed out from all sessions (${released} device slot(s) freed)` };
    } catch (err: any) {
        console.error('[adminSignOutUser] Failed:', err);
        return { success: false, message: err?.message ?? 'Failed to sign out user' };
    }
};
