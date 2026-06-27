import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminListCodes';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: Schema['AdminListCodes']['functionHandler'] = async (event): Promise<any> => {
    requireAdmin(event);

    const result = await client.models.PromoCode.list({});
    const now = Date.now();

    const codes = (result.data ?? []).map((c) => {
        const isExpired = c.expiresAt ? new Date(c.expiresAt).getTime() < now : false;
        const isExhausted = (c.redemptionCount ?? 0) >= (c.maxRedemptions ?? 1);
        const status = isExpired || isExhausted ? 'inactive' : 'active';
        return {
            code: c.code,
            label: c.label,
            maxRedemptions: c.maxRedemptions ?? 1,
            redemptionCount: c.redemptionCount ?? 0,
            expiresAt: c.expiresAt,
            expiresInDays: c.expiresInDays,
            planTier: c.planTier ?? 'free',
            maxDevices: c.maxDevices ?? 1,
            createdAt: c.createdAt,
            status,
        };
    });

    return { codes };
};
