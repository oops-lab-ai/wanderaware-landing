import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminRevokeCode';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

/**
 * Revoke a promo code by setting `expiresAt = now`. Existing grants from this code
 * are NOT touched — their `Organization.grantExpiresAt` was stamped at redemption time
 * and remains valid until that timestamp passes (or an admin revokes the org directly).
 */
export const handler: Schema['AdminRevokeCode']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { code } = event.arguments;

    const result = await client.models.PromoCode.update({
        code,
        expiresAt: new Date().toISOString(),
    });

    if (!result.data) {
        return { success: false, message: 'Code not found' };
    }

    console.log(`[adminRevokeCode] Revoked code ${code}`);
    return { success: true, message: 'Code revoked. Existing grants remain active.' };
};
