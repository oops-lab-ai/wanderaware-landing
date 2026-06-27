import { randomBytes } from 'crypto';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/adminCreateCode';
import { Schema } from '../../data/resource';
import { requireAdmin } from '../shared/adminAuth';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

type PlanTier = 'free' | 'basic' | 'professional' | 'enterprise';

const SEAT_DEFAULTS: Record<PlanTier, number> = {
    free: 1,
    basic: 1,
    professional: 5,
    enterprise: 999999,
};

function generateCodeString(label: string | null | undefined): string {
    const labelSlug = (label ?? 'care center')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 12);
    const random = randomBytes(8).toString('base64url');
    return `${labelSlug}-${random}`;
}

function normalizeTier(planTier: string | null | undefined): PlanTier {
    const tier = (planTier ?? 'free').trim().toLowerCase();
    if (!['free', 'basic', 'professional', 'enterprise'].includes(tier)) {
        throw new Error('planTier must be free, basic, professional, or enterprise');
    }
    return tier as PlanTier;
}

/**
 * GUI version of `backend/scripts/create-promo-code.ts`. Lives behind the
 * Admin → Grants → Codes "Create" dialog. Same data shape, same logic.
 */
export const handler: Schema['AdminCreateCode']['functionHandler'] = async (event) => {
    requireAdmin(event);

    const { label, maxRedemptions, expiresInDays, codeExpiresInDays, planTier, maxDevices } = event.arguments;
    const code = generateCodeString(label);
    const tier = normalizeTier(planTier);
    const seats = maxDevices ?? SEAT_DEFAULTS[tier];
    if (!Number.isInteger(seats) || seats < 1) {
        return { success: false, code: null, message: 'maxDevices must be at least 1' };
    }

    const codeExpiresAt = codeExpiresInDays
        ? new Date(Date.now() + codeExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const created = await client.models.PromoCode.create({
        code,
        label: label ?? null,
        maxRedemptions: maxRedemptions ?? 1,
        redemptionCount: 0,
        expiresAt: codeExpiresAt,
        expiresInDays: expiresInDays ?? null,
        planTier: tier,
        maxDevices: seats,
    });

    if (!created.data) {
        return { success: false, code: null, message: 'Failed to create promo code' };
    }

    console.log(`[adminCreateCode] Created ${code} (label: ${label ?? 'none'}, max: ${maxRedemptions ?? 1})`);

    return {
        success: true,
        code,
        message: 'Promo code created',
    };
};
