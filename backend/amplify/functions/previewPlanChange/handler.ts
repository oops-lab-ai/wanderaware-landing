import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/previewPlanChange';
import type { Schema } from '../../data/resource';
import Stripe from 'stripe';
import { stripePriceToTier, tierToLimits, getTierDisplayName } from '../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' });

const TIER_RANK: Record<string, number> = { basic: 1, professional: 2, enterprise: 3 };

export const handler: Schema['PreviewPlanChange']['functionHandler'] = async (event) => {
    const { organizationId, newPriceId } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) throw new Error('Unauthorized');

    const { data: org } = await client.models.Organization.get({ id: organizationId });
    if (!org || org.deletedAt) throw new Error('Organization not found');

    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    if (!org.stripeCustomerId) throw new Error('No Stripe customer found');

    // Include trialing subs — a customer on a free trial can still upgrade.
    // Stripe's `status: 'active'` filter excludes trialing, so we list all and filter in-memory.
    const subscriptions = await stripe.subscriptions.list({
        customer: org.stripeCustomerId,
        status: 'all',
        limit: 10,
    });

    const sub = subscriptions.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (!sub) throw new Error('No active or trialing subscription');

    const isTrialing = sub.status === 'trialing';
    const currentItem = sub.items.data[0];
    const currentTierMeta = currentItem.price.metadata?.tier;
    const newPrice = await stripe.prices.retrieve(newPriceId);
    const newTierMeta = newPrice.metadata?.tier;

    const currentTier = currentTierMeta ? stripePriceToTier(currentTierMeta) : 'basic';
    const newTier = newTierMeta ? stripePriceToTier(newTierMeta) : 'basic';
    const isUpgrade = (TIER_RANK[newTier] || 0) > (TIER_RANK[currentTier] || 0);

    if (isUpgrade) {
        // Trial-preserving upgrade (industry standard — Stripe portal, GitHub, Notion, etc.):
        // user keeps remaining trial days at the new tier's price. Nothing is charged today;
        // the new monthly amount kicks in at trial_end. Stripe's invoice preview returns $0
        // during a trial (the trial absorbs the proration), which is what we want here.
        if (isTrialing) {
            const newAmount = (newPrice.unit_amount || 0) / 100;
            const periodEnd = currentItem.current_period_end;
            return {
                direction: 'upgrade',
                prorationAmount: 0,
                creditAmount: 0,
                chargeAmount: 0,
                newMonthlyAmount: newAmount,
                currentMonthlyAmount: (currentItem.price.unit_amount || 0) / 100,
                effectiveDate: new Date().toISOString(),
                periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            };
        }

        // Preview the prorated invoice.
        // Do NOT pass proration_date — let Stripe use the subscription's current time.
        // This respects test clocks for testing and uses real time in production.
        const preview = await stripe.invoices.createPreview({
            customer: org.stripeCustomerId,
            subscription: sub.id,
            subscription_details: {
                items: [{ id: currentItem.id, price: newPriceId }],
                proration_behavior: 'create_prorations',
            },
        });

        // Categorize line items:
        // - Proration lines: parent.subscription_item_details.proration === true
        //   - Negative amount = credit for unused time on old plan
        //   - Positive amount = charge for remaining time on new plan
        // - Non-proration line: the next full billing cycle charge
        // On back-to-back upgrades within the same period, Stripe emits redundant
        // pairs of proration lines that cancel out. Example: Individual→Team→Enterprise
        // in 5 minutes produces:
        //   -$98.95  Unused time on Team after May 29   (refund of the Team prorated charge from Ind→Team)
        //   +$248.86 Remaining time on Enterprise after May 29
        //   -$48.97  Unused time on Individual after May 29  (refund of the Individual credit from Ind→Team)
        //   +$98.95  Remaining time on Team after May 29   (re-applies the Team charge that was refunded above)
        // Lines 1 and 4 cancel exactly. Net charge is line 2 only ($248.86), and the
        // residual credit is line 3 (-$48.97) — which together = $199.89, the actual
        // amount the user owes today.
        //
        // We collapse cancelling pairs by `period.start + period.end + |amount|` (these
        // identify "the same proration window") so the dialog shows only the meaningful
        // charge + credit instead of all four lines summed together.
        const prorationLines: Array<{ amount: number; description: string; key: string }> = [];
        let nextCycleTotal = 0;

        for (const line of preview.lines.data) {
            const isProration = (line as any).parent?.subscription_item_details?.proration === true;
            console.log(`[preview] line: ${line.amount / 100} | proration: ${isProration} | ${line.description}`);
            if (isProration) {
                const period = (line as any).period;
                const key = `${period?.start ?? ''}-${period?.end ?? ''}-${Math.abs(line.amount)}`;
                prorationLines.push({ amount: line.amount, description: line.description ?? '', key });
            } else {
                nextCycleTotal += line.amount;
            }
        }

        // Collapse pairs with matching period+abs(amount) and opposite signs.
        const usedIndices = new Set<number>();
        const survivors: Array<{ amount: number; description: string }> = [];
        for (let i = 0; i < prorationLines.length; i++) {
            if (usedIndices.has(i)) continue;
            const a = prorationLines[i];
            // Find a partner with same key but opposite sign.
            const partnerIdx = prorationLines.findIndex(
                (b, j) => j !== i && !usedIndices.has(j) && b.key === a.key && Math.sign(b.amount) === -Math.sign(a.amount),
            );
            if (partnerIdx >= 0) {
                usedIndices.add(i);
                usedIndices.add(partnerIdx);
                continue;
            }
            survivors.push({ amount: a.amount, description: a.description });
        }

        let creditTotal = 0;
        let chargeTotal = 0;
        for (const line of survivors) {
            if (line.amount < 0) creditTotal += line.amount;
            else chargeTotal += line.amount;
        }

        const periodEnd = currentItem.current_period_end;
        const periodEndDate = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

        // Total proration = credits + charges (net amount for current period change)
        const prorationNet = creditTotal + chargeTotal;
        const totalDueToday = Math.max(0, prorationNet / 100);

        console.log(`[preview] credits: ${creditTotal / 100}, charges: ${chargeTotal / 100}, next cycle: ${nextCycleTotal / 100}, total due: ${totalDueToday}`);

        return {
            direction: 'upgrade',
            prorationAmount: totalDueToday,
            creditAmount: creditTotal / 100,
            chargeAmount: chargeTotal / 100,
            newMonthlyAmount: (newPrice.unit_amount || 0) / 100,
            currentMonthlyAmount: (currentItem.price.unit_amount || 0) / 100,
            effectiveDate: new Date().toISOString(),
            periodEnd: periodEndDate,
        };
    } else {
        const periodEnd = currentItem.current_period_end ? new Date(currentItem.current_period_end * 1000).toISOString() : null;

        // Block downgrade if active device plan count exceeds the target tier. A "seat"
        // = one DeviceActivation row (per getOrgUsage). The frontend renders a different
        // dialog when blocked=true and disables the Confirm button. See changePlan handler
        // for the matching submit-time guard (defense-in-depth) and paymentProcessor for
        // the runtime safety net that auto-revokes excess seats at billing transition.
        const newLimits = tierToLimits(newTier);
        const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
            organizationId,
        });
        const seatsUsed = activations.data?.length ?? 0;

        if (seatsUsed > newLimits.maxDevices) {
            const excess = seatsUsed - newLimits.maxDevices;
            return {
                direction: 'downgrade',
                blocked: true,
                blockReason: `Your org has ${seatsUsed} active device plan${seatsUsed === 1 ? '' : 's'} but ${getTierDisplayName(newTier)} supports ${newLimits.maxDevices}. Revoke ${excess} device plan${excess === 1 ? '' : 's'} before downgrading.`,
                seatsUsed,
                newTierMaxSeats: newLimits.maxDevices,
                prorationAmount: 0,
                creditAmount: 0,
                chargeAmount: 0,
                newMonthlyAmount: (newPrice.unit_amount || 0) / 100,
                currentMonthlyAmount: (currentItem.price.unit_amount || 0) / 100,
                effectiveDate: null,
                periodEnd,
            };
        }

        return {
            direction: 'downgrade',
            prorationAmount: 0,
            newMonthlyAmount: (newPrice.unit_amount || 0) / 100,
            currentMonthlyAmount: (currentItem.price.unit_amount || 0) / 100,
            effectiveDate: periodEnd,
            periodEnd,
        };
    }
};
