import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/changePlan';
import type { Schema } from '../../data/resource';
import Stripe from 'stripe';
import { stripePriceToTier, tierToLimits, getTierDisplayName, type PlanTier } from '../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

// Tier ranking for upgrade vs downgrade detection
const TIER_RANK: Record<string, number> = { basic: 1, professional: 2, enterprise: 3 };

async function recordPlanAudit(args: {
    organizationId: string;
    actorUserId: string;
    action: string;
    oldOrg: any;
    newPlanTier: PlanTier | null;
    newPlanSource: string | null;
    newMaxSeats: number | null;
    newGrantExpiresAt?: string | null;
    reason?: string | null;
}) {
    await client.models.AdminPlanAudit.create({
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        action: args.action,
        oldPlanTier: args.oldOrg?.planTier ?? null,
        newPlanTier: args.newPlanTier,
        oldPlanSource: args.oldOrg?.planSource ?? null,
        newPlanSource: args.newPlanSource,
        oldMaxSeats: args.oldOrg?.maxDevices ?? null,
        newMaxSeats: args.newMaxSeats,
        oldGrantExpiresAt: args.oldOrg?.grantExpiresAt ?? null,
        newGrantExpiresAt: args.newGrantExpiresAt ?? null,
        reason: args.reason ?? null,
    });
}

export const handler: Schema['ChangePlan']['functionHandler'] = async (event) => {
    const { organizationId, newPriceId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Verify caller is owner or admin
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin');
    }

    const { data: org } = await client.models.Organization.get({ id: organizationId });
    if (!org?.stripeCustomerId) {
        throw new Error('No Stripe customer found. Subscribe to a plan first.');
    }

    // Include trialing subs — a customer on a free trial can still upgrade.
    // Stripe's `status: 'active'` filter excludes trialing, so we list all and filter in-memory.
    const subscriptions = await stripe.subscriptions.list({
        customer: org.stripeCustomerId,
        status: 'all',
        limit: 10
    });

    const sub = subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (!sub) {
        throw new Error('No active or trialing subscription found');
    }

    const isTrialing = sub.status === 'trialing';

    // Get current and new price details
    const currentItem = sub.items.data[0];
    const currentPriceId = currentItem.price.id;

    if (currentPriceId === newPriceId) {
        throw new Error('Already on this plan');
    }

    // Determine current and new tiers
    const currentTierMeta = currentItem.price.metadata?.tier;
    const newPrice = await stripe.prices.retrieve(newPriceId);
    const newTierMeta = newPrice.metadata?.tier;

    if (!currentTierMeta || !newTierMeta) {
        throw new Error('Price metadata missing tier information');
    }

    const currentTier = stripePriceToTier(currentTierMeta);
    const newTier = stripePriceToTier(newTierMeta);
    const isUpgrade = (TIER_RANK[newTier] || 0) > (TIER_RANK[currentTier] || 0);

    if (isUpgrade) {
        // UPGRADE: Immediate with prorations
        // If there's a pending downgrade schedule, release it first
        if (sub.schedule) {
            const scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id;
            const existingSchedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
            if (existingSchedule.status === 'active' || existingSchedule.status === 'not_started') {
                await stripe.subscriptionSchedules.release(scheduleId);
            }
        }

        // Industry standard (Stripe portal default, GitHub, Notion, Linear, Vercel, Slack):
        // preserve the trial on upgrade. The user keeps their remaining trial days at the
        // new tier's price and is charged the new amount when the trial ends naturally.
        // No surprise — the preview screen surfaces "trial continues until X, then $Y/mo".
        // Stripe automatically copies trial_end to the new price, so we don't pass it.
        await stripe.subscriptions.update(sub.id, {
            items: [{ id: currentItem.id, price: newPriceId }],
            proration_behavior: 'create_prorations'
        });

        // Update org immediately so UI reflects the new plan without waiting for webhook
        const limits = tierToLimits(newTier);
        await client.models.Organization.update({
            id: organizationId,
            planTier: newTier,
            planSource: 'stripe',
            maxDevices: limits.maxDevices,
            grantExpiresAt: null,
            scheduledDowngradeTier: null,
            scheduledDowngradeDate: null
        });
        await recordPlanAudit({
            organizationId,
            actorUserId: callerId,
            action: 'stripe-upgrade-plan',
            oldOrg: org,
            newPlanTier: newTier,
            newPlanSource: 'stripe',
            newMaxSeats: limits.maxDevices,
            reason: `Stripe upgrade requested through billing workflow from ${getTierDisplayName(currentTier)} to ${getTierDisplayName(newTier)}.`,
        });

        console.log(`[changePlan] Upgrade: ${currentTier} → ${newTier} (immediate, prorated)`);

        return {
            success: true,
            message: isTrialing
                ? `Upgraded to ${getTierDisplayName(newTier)}. Your trial continues — first charge at trial end.`
                : `Upgraded to ${getTierDisplayName(newTier)}. Prorated charge applied.`,
            effectiveDate: new Date().toISOString(),
            newTier
        };
    } else {
        // DOWNGRADE: Schedule price change at end of current billing period.
        // User keeps their current (higher) plan until the period ends, then switches to the lower plan.
        // Uses Stripe Subscription Schedules to defer the change.

        // Defense-in-depth: re-check active capacity here in case the user bypassed the
        // preview dialog (direct GraphQL call) or activated new devices after preview
        // ran. Mirrors the check in previewPlanChange. The frontend toast surfaces
        // this thrown message via the existing mutation result.message pattern.
        const newLimits = tierToLimits(newTier);
        const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
            organizationId,
        });
        const seatsUsed = activations.data?.length ?? 0;

        if (seatsUsed > newLimits.maxDevices) {
            const excess = seatsUsed - newLimits.maxDevices;
            throw new Error(
                `Your org has ${seatsUsed} active device slot${seatsUsed === 1 ? '' : 's'} but ${getTierDisplayName(newTier)} supports ${newLimits.maxDevices}. Revoke ${excess} device slot${excess === 1 ? '' : 's'} before downgrading.`,
            );
        }

        const periodEnd = currentItem.current_period_end;
        const periodStart = currentItem.current_period_start;

        // Check if subscription already has a schedule attached
        let scheduleId: string | null = null;
        if (sub.schedule) {
            scheduleId = typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id;
        }

        const phaseConfig = {
            phases: [
                {
                    items: [{ price: currentItem.price.id, quantity: 1 }],
                    start_date: periodStart as number,
                    end_date: periodEnd as number,
                },
                {
                    items: [{ price: newPriceId, quantity: 1 }],
                    start_date: periodEnd as number,
                },
            ],
        };

        if (scheduleId) {
            // Update existing schedule — replace the future phase
            await stripe.subscriptionSchedules.update(scheduleId, phaseConfig);
        } else {
            // Create a new schedule from the existing subscription, then set phases
            const schedule = await stripe.subscriptionSchedules.create({
                from_subscription: sub.id,
            });
            await stripe.subscriptionSchedules.update(schedule.id, {
                end_behavior: 'release',
                ...phaseConfig,
            });
        }

        const periodEndDate = periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : new Date().toISOString();

        // Store scheduled downgrade on org so frontend can show it
        await client.models.Organization.update({
            id: organizationId,
            scheduledDowngradeTier: newTier,
            scheduledDowngradeDate: periodEndDate
        });
        await recordPlanAudit({
            organizationId,
            actorUserId: callerId,
            action: 'stripe-schedule-downgrade',
            oldOrg: org,
            newPlanTier: newTier,
            newPlanSource: 'stripe',
            newMaxSeats: newLimits.maxDevices,
            reason: `Stripe downgrade scheduled from ${getTierDisplayName(currentTier as PlanTier)} to ${getTierDisplayName(newTier)} for ${periodEndDate}. Current plan remains active until then.`,
        });

        console.log(`[changePlan] Downgrade scheduled: ${currentTier} → ${newTier} at ${periodEndDate}`);

        return {
            success: true,
            message: `Downgrade to ${getTierDisplayName(newTier)} scheduled. Your ${getTierDisplayName(currentTier as PlanTier)} plan continues until ${new Date(periodEnd * 1000).toLocaleDateString()}.`,
            effectiveDate: periodEndDate,
            newTier
        };
    }
};
