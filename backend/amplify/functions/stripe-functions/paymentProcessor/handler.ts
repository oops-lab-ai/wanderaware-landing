import { SQSEvent } from 'aws-lambda';
import Stripe from 'stripe';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '../../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/paymentProcessor';
import { Amplify } from 'aws-amplify';
import { PLAN_TIERS, stripePriceToTier, tierToLimits, type PlanTier } from '../../shared/tierConstants';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia'
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Stripe API ≥2024 prefers item-level current_period_end (multi-item subs each have their
// own cycle). Older API versions kept it at sub level. Both fields are still populated by
// Stripe for single-item subs in current API versions, but we've observed the item-level
// field intermittently absent during rapid resubscribe-after-cancel sequences. Fall back
// to sub-level so DDB.currentPeriodEnd is never null when Stripe has a real value.
function getCurrentPeriodEnd(liveSub: Stripe.Subscription): number | null {
    return (
        liveSub.items.data[0]?.current_period_end ??
        // Stripe SDK types removed `current_period_end` from the sub level in newer versions
        // even though the value is still present at runtime. Cast intentional.
        (liveSub as any).current_period_end ??
        null
    );
}

const getOrganizationById = async (organizationId: string) => {
    const result = await client.models.Organization.get({ id: organizationId });
    return result.data;
};

const getOrganizationByStripeCustomerId = async (stripeCustomerId: string) => {
    const result = await client.models.Organization.listOrganizationByStripeCustomerId({ stripeCustomerId });
    return result.data?.[0] ?? null;
};

const getOrgIdFromSubscription = (subscription: Stripe.Subscription): string | null => {
    return subscription.metadata?.organizationId ?? null;
};

const getOrgIdFromInvoice = async (invoice: Stripe.Invoice): Promise<string | null> => {
    const invoiceAny = invoice as any;

    const orgId =
        invoice.metadata?.organizationId ||
        invoiceAny.parent?.subscription_details?.metadata?.organizationId;

    if (orgId) return orgId;

    const subscriptionId =
        invoiceAny.parent?.subscription_details?.subscription ||
        invoiceAny.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;

    if (subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
            if (subscription.metadata?.organizationId) {
                return subscription.metadata.organizationId;
            }
        } catch (error) {
            console.error(`[getOrgIdFromInvoice] Error fetching subscription:`, error);
        }
    }

    console.error(`[getOrgIdFromInvoice] No organizationId found in any location`);
    return null;
};

// Tier ranking — used to detect downgrade transitions in handleSubscriptionUpdated.
// Mirrors the table in changePlan/handler.ts. Free is rank 0 (only ever entered via
// promo grants, not via paid subscriptions, but we list it for completeness).
const TIER_RANK: Record<string, number> = { free: 0, basic: 1, professional: 2, enterprise: 3 };

function safeStripePriceToTier(tierMetadata: string | null | undefined, context: string): PlanTier | null {
    try {
        return stripePriceToTier(tierMetadata);
    } catch (error) {
        console.warn(
            `[${context}] Skipping Stripe event because price metadata.tier is missing or unsupported: ${tierMetadata ?? 'undefined'}`,
        );
        return null;
    }
}

// Runtime safety net: when a subscription transitions to a lower tier (or DynamoDB ends up over capacity)
// for any reason), revoke excess DeviceActivation rows to bring the count back within
// newMaxSeats. Newest activations are revoked first (sorted by activatedAt DESC). The org
// owner is protected from being kicked off entirely: if they have any device, their oldest
// one is preserved even if it would otherwise be in the revoked slice.
//
// Revoked devices' next call to validateDeviceCapacity will fail (the row no longer exists),
// so the web client logs them out automatically.
const revokeExcessSeats = async (
    organizationId: string,
    newMaxSeats: number,
    ownerId: string,
) => {
    const activations = await client.models.DeviceActivation.listDeviceActivationByOrganizationId({
        organizationId,
    });
    const all = (activations.data ?? []).slice();
    if (all.length <= newMaxSeats) return;

    all.sort((a, b) => new Date(b.activatedAt ?? 0).getTime() - new Date(a.activatedAt ?? 0).getTime());

    // Owner protection: pick the oldest owner-owned device to reserve so they keep at
    // least one slot. If owner has no devices, no reservation needed.
    const ownerActivations = all.filter((a) => a.userId === ownerId);
    const reservedKey = ownerActivations.length > 0
        ? `${ownerActivations[ownerActivations.length - 1].userId}:${ownerActivations[ownerActivations.length - 1].deviceId}`
        : null;

    const candidates = all.filter((a) => `${a.userId}:${a.deviceId}` !== reservedKey);
    const excessCount = all.length - newMaxSeats;
    const toRevoke = candidates.slice(0, excessCount);

    for (const a of toRevoke) {
        await client.models.DeviceActivation.delete({ userId: a.userId, deviceId: a.deviceId });
        console.log(
            `[revokeExcessSeats] org=${organizationId} revoked device=${a.deviceId} user=${a.userId} (newest-first; activatedAt=${a.activatedAt})`,
        );
    }
    console.log(
        `[revokeExcessSeats] org=${organizationId}: ${toRevoke.length} revoked, ${all.length - toRevoke.length} preserved (max=${newMaxSeats}${reservedKey ? ', owner reserved' : ''})`,
    );
};

const recordPlanAudit = async (args: {
    organizationId: string;
    action: string;
    oldOrg: any;
    newPlanTier: PlanTier | null;
    newPlanSource: string | null;
    newMaxSeats: number | null;
    newGrantExpiresAt?: string | null;
    reason?: string | null;
}) => {
    try {
        await client.models.AdminPlanAudit.create({
            organizationId: args.organizationId,
            actorUserId: null,
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
    } catch (error) {
        console.error(`[recordPlanAudit] Failed to write audit for org=${args.organizationId}, action=${args.action}:`, error);
    }
};

const updateOrgTier = async (
    organizationId: string,
    newTier: PlanTier | null,
    subscriptionStatus?: string | null,
    auditAction = 'stripe-update-plan',
    auditReason?: string | null,
) => {
    const oldOrg = await getOrganizationById(organizationId);
    const maxDevices = newTier ? tierToLimits(newTier).maxDevices : 0;
    await client.models.Organization.update({
        id: organizationId,
        planTier: newTier,
        planSource: newTier ? 'stripe' : null,
        maxDevices,
        grantExpiresAt: null,
        // Clear all subscription-pending state when revoking. Leaving any of these set
        // causes the UI to render contradictory copy ("No Plan" + "cancels on…" banner
        // simultaneously, or "No Plan" + stale "Past Due" badge).
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        scheduledDowngradeTier: null,
        scheduledDowngradeDate: null,
        ...(subscriptionStatus !== undefined
            ? { subscriptionStatus }
            : newTier === null
                ? { subscriptionStatus: 'canceled' }
                : {})
    });
    await recordPlanAudit({
        organizationId,
        action: auditAction,
        oldOrg,
        newPlanTier: newTier,
        newPlanSource: newTier ? 'stripe' : null,
        newMaxSeats: maxDevices,
        newGrantExpiresAt: null,
        reason: auditReason ?? `Stripe webhook reconciled subscription status${subscriptionStatus ? ` (${subscriptionStatus})` : ''}.`,
    });
    const newMaxSeats = newTier ? tierToLimits(newTier).maxDevices : 0;
    console.log(`[updateOrgTier] Organization ${organizationId} updated: planTier=${newTier}, maxDevices=${newMaxSeats}`);
};

// ============================================================================
// EVENT HANDLERS
// ============================================================================

const handleTrialWillEnd = async (subscription: Stripe.Subscription) => {
    console.log(`[trial_will_end] Trial ending soon for subscription: ${subscription.id}`);
    // TODO: Implement reminder email logic
};

const handleSubscriptionCreated = async (subscription: Stripe.Subscription) => {
    console.log(`[subscription.created] Processing - status: ${subscription.status}, id: ${subscription.id}`);

    const organizationId = getOrgIdFromSubscription(subscription);
    if (!organizationId) {
        console.log(`[subscription.created] Skipping - missing organizationId metadata`);
        return;
    }

    const org = await getOrganizationById(organizationId);
    if (!org) {
        console.log(`[subscription.created] Skipping - organization not found: ${organizationId}`);
        return;
    }

    // Guard against stale/reordered SQS events — re-check live Stripe state
    const liveSub = await stripe.subscriptions.retrieve(subscription.id);
    const { customer } = subscription;

    if (liveSub.status === 'active' || liveSub.status === 'trialing') {
        const liveItem = liveSub.items.data[0];
        const tierMetadata = liveItem?.price?.metadata?.tier ?? liveItem?.plan?.metadata?.tier;
        const newTier = safeStripePriceToTier(tierMetadata, 'subscription.created');
        if (!newTier) {
            await client.models.Organization.update({
                id: organizationId,
                stripeCustomerId: customer as string,
                subscriptionStatus: liveSub.status,
            });
            return;
        }
        const limits = tierToLimits(newTier);
        const periodEndUnix = getCurrentPeriodEnd(liveSub);
        const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
        // Trial-granted means EITHER status=trialing OR a trial_end is set on the sub.
        // Stripe sometimes flips trialing→active mid-period; this catches both.
        const trialGranted = liveSub.status === 'trialing' || !!liveSub.trial_end;
        await client.models.Organization.update({
            id: organizationId,
            stripeCustomerId: customer as string,
            planTier: newTier,
            planSource: 'stripe',
            maxDevices: limits.maxDevices,
            grantExpiresAt: null,
            cancelAtPeriodEnd: liveSub.cancel_at_period_end ?? false,
            currentPeriodEnd: periodEnd,
            subscriptionStatus: liveSub.status
        });
        await recordPlanAudit({
            organizationId,
            action: 'stripe-subscription-created',
            oldOrg: org,
            newPlanTier: newTier,
            newPlanSource: 'stripe',
            newMaxSeats: limits.maxDevices,
            newGrantExpiresAt: null,
            reason: `Stripe subscription ${liveSub.id} is ${liveSub.status}; converted organization billing source to Stripe.`,
        });
        // Mark THIS user as having used their lifetime trial. Reads userId out of the
        // subscription metadata (set by createCheckoutSession). Falls back to the org
        // owner if the metadata is missing — defensive, but in practice the metadata
        // is always present.
        if (trialGranted) {
            const userId = (subscription.metadata?.userId as string | undefined) ?? org.ownerId;
            if (userId) {
                await client.models.Profile.update({
                    id: userId,
                    hasUsedTrial: true
                });
                console.log(`[subscription.created] User ${userId} marked Profile.hasUsedTrial=true`);
            }
        }
        console.log(`[subscription.created] Organization ${organizationId} updated: tier=${newTier}, maxDevices=${limits.maxDevices} (live: ${liveSub.status}), stripeCustomerId=${customer}`);
    } else {
        console.log(`[subscription.created] Live status is ${liveSub.status} — linking customer only`);
        // incomplete / past_due / canceled — only link customer, don't grant tier
        await client.models.Organization.update({
            id: organizationId,
            stripeCustomerId: customer as string
        });
        console.log(`[subscription.created] Organization ${organizationId}: status=${liveSub.status}, linked customer only`);
    }
};

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
    console.log(`[subscription.updated] Processing - status: ${subscription.status}, id: ${subscription.id}`);

    const organizationId = getOrgIdFromSubscription(subscription);
    if (!organizationId) {
        console.log(`[subscription.updated] Skipping - missing organizationId metadata`);
        return;
    }

    const org = await getOrganizationById(organizationId);
    if (!org) {
        console.log(`[subscription.updated] Skipping - organization not found: ${organizationId}`);
        return;
    }

    const { status } = subscription;

    if (status === 'active' || status === 'trialing') {
        // Retrieve live subscription to guard against stale/reordered SQS events
        const liveSub = await stripe.subscriptions.retrieve(subscription.id);
        if (liveSub.status !== 'active' && liveSub.status !== 'trialing') {
            console.log(`[subscription.updated] Stale active/trialing event — live status is ${liveSub.status}. Skipping.`);
            return;
        }

        const liveItem = liveSub.items.data[0];
        const tierMetadata = liveItem?.price?.metadata?.tier ?? liveItem?.plan?.metadata?.tier;
        const newTier = safeStripePriceToTier(tierMetadata, 'subscription.updated');
        if (!newTier) {
            await client.models.Organization.update({
                id: organizationId,
                subscriptionStatus: liveSub.status,
                ...(!org.stripeCustomerId ? { stripeCustomerId: liveSub.customer as string } : {}),
            });
            return;
        }

        // Two cancellation flavors land here, depending on the Stripe Customer Portal config:
        //   (a) cancel_at_period_end=true on the subscription itself (no schedule)
        //   (b) a subscription schedule with hard cancel_at timestamp (cancel_at_period_end stays FALSE)
        // Path (b) fires when the portal collects feedback before cancel — that workflow uses a
        // schedule under the hood. Treat both as "cancellation pending" so the dashboard banner shows.
        // For the date: when a schedule is active, cancel_at IS the truth — current_period_end is just
        // the next normal renewal that won't actually happen. Prefer cancel_at; fall back to renewal.
        const isScheduledForCancellation = !!liveSub.cancel_at_period_end || liveSub.cancel_at != null;
        // Prefer cancel_at when scheduled (that IS the truth date); otherwise the regular
        // period end via the helper (item-level → sub-level fallback).
        const cancellationDate = liveSub.cancel_at ?? getCurrentPeriodEnd(liveSub);
        const periodEnd = cancellationDate ? new Date(cancellationDate * 1000).toISOString() : null;

        if (org.planTier !== newTier) {
            console.log(`[subscription.updated] Tier change: ${org.planTier} -> ${newTier}`);
            await updateOrgTier(
                organizationId,
                newTier,
                liveSub.status,
                'stripe-subscription-updated',
                `Stripe subscription ${liveSub.id} changed tier from ${org.planTier ?? 'none'} to ${newTier}.`,
            );

            // On a downgrade, revoke excess DeviceActivation rows so the org doesn't end
            // up with more device slots consumed than the new tier allows. This is the runtime
            // safety net; preview/submit-time blocks in changePlan/previewPlanChange catch
            // most cases before they get here. See revokeExcessSeats() for ordering rules.
            const oldRank = org.planTier ? TIER_RANK[org.planTier] ?? 0 : 0;
            const newRank = TIER_RANK[newTier] ?? 0;
            if (newRank < oldRank) {
                await revokeExcessSeats(organizationId, tierToLimits(newTier).maxDevices, org.ownerId);
            }
        }

        // Always update cancellation state + period end. Also propagate Stripe's authoritative
        // subscription status (active/trialing/past_due/etc) so the PlanStatusBadge has truth.
        await client.models.Organization.update({
            id: organizationId,
            cancelAtPeriodEnd: isScheduledForCancellation,
            currentPeriodEnd: periodEnd,
            subscriptionStatus: liveSub.status,
            planSource: 'stripe',
            grantExpiresAt: null,
            ...(!org.stripeCustomerId ? { stripeCustomerId: liveSub.customer as string } : {})
        });

        if (isScheduledForCancellation) {
            console.log(`[subscription.updated] Cancellation scheduled — access continues until ${periodEnd}`);
        }
    } else if (['past_due', 'unpaid', 'canceled', 'incomplete_expired', 'paused'].includes(status)) {
        // Verify live status to guard against stale/reordered events
        try {
            const liveSub = await stripe.subscriptions.retrieve(subscription.id);
            if (liveSub.status === 'active' || liveSub.status === 'trialing') {
                console.log(`[subscription.updated] Stale ${status} event — live status is ${liveSub.status}. Skipping revocation.`);
            } else {
                console.log(`[subscription.updated] ${status} confirmed (live: ${liveSub.status}) — Revoking access`);
                await updateOrgTier(
                    organizationId,
                    null,
                    liveSub.status,
                    `stripe-subscription-${liveSub.status}`,
                    `Stripe subscription ${liveSub.id} status is ${liveSub.status}; revoked paid access.`,
                );
            }
        } catch (err) {
            console.error(`[subscription.updated] Error verifying live subscription status:`, err);
            // Fail safe: don't revoke if we can't verify
        }
    }
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
    console.log(`[subscription.deleted] Processing subscription: ${subscription.id}`);

    const organizationId = getOrgIdFromSubscription(subscription);
    if (!organizationId) {
        console.log(`[subscription.deleted] No organizationId in metadata, skipping`);
        return;
    }

    const org = await getOrganizationById(organizationId);
    if (!org) {
        console.log(`[subscription.deleted] Organization not found: ${organizationId}`);
        return;
    }

    // Verify no other active subscriptions exist before downgrading
    try {
        const liveSubs = await stripe.subscriptions.list({
            customer: subscription.customer as string,
            status: 'all',
            limit: 100
        });
        const stillActive = liveSubs.data.some(
            (sub) =>
                sub.id !== subscription.id &&
                (sub.status === 'active' || sub.status === 'trialing') &&
                sub.metadata?.organizationId === organizationId
        );
        if (stillActive) {
            console.log(`[subscription.deleted] Another active subscription exists — skipping downgrade`);
            return;
        }
    } catch (err) {
        console.error(`[subscription.deleted] Error checking live subscriptions:`, err);
        // Fail safe: proceed with downgrade if we can't verify
    }

    console.log(`[subscription.deleted] Revoking access for org ${organizationId}`);
    await updateOrgTier(
        organizationId,
        null,
        'canceled',
        'stripe-subscription-deleted',
        `Stripe subscription ${subscription.id} was deleted; revoked paid access.`,
    );
};

const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
    console.log(`[invoice.paid] Processing - billing_reason: ${invoice.billing_reason}`);

    const organizationId = await getOrgIdFromInvoice(invoice);
    if (!organizationId) {
        console.log(`[invoice.paid] Skipping - no organizationId found`);
        return;
    }

    const org = await getOrganizationById(organizationId);
    if (!org) {
        console.log(`[invoice.paid] Skipping - organization not found: ${organizationId}`);
        return;
    }

    const invoiceAny = invoice as any;
    const subscriptionId =
        invoiceAny.parent?.subscription_details?.subscription ||
        invoiceAny.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;

    if (subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);

            // Only reconcile tier if subscription is genuinely active
            if (subscription.status !== 'active' && subscription.status !== 'trialing') {
                console.log(`[invoice.paid] Subscription ${subscriptionId} status is ${subscription.status} — skipping tier reconciliation`);
            } else {
                const subItem = subscription.items.data[0];
                const tierMetadata = subItem?.price?.metadata?.tier ?? subItem?.plan?.metadata?.tier;
                const expectedTier = safeStripePriceToTier(tierMetadata, 'invoice.paid');
                if (!expectedTier) {
                    return;
                }

                const limits = tierToLimits(expectedTier);
                const periodEndUnix = getCurrentPeriodEnd(subscription);
                const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
                const shouldReconcile =
                    org.planTier !== expectedTier ||
                    org.planSource !== 'stripe' ||
                    org.maxDevices !== limits.maxDevices ||
                    org.subscriptionStatus !== subscription.status;

                if (shouldReconcile) {
                    const isPastDueRecovery = !org.planTier || org.subscriptionStatus === 'past_due' || org.subscriptionStatus === 'unpaid';
                    console.log(
                        isPastDueRecovery
                            ? `[invoice.paid] BILLING RECOVERY: Restoring org ${organizationId} to ${expectedTier} (${subscription.status})`
                            : `[invoice.paid] Stripe reconciliation: org tier/status=${org.planTier}/${org.subscriptionStatus}, expected=${expectedTier}/${subscription.status}. Correcting.`
                    );
                    await client.models.Organization.update({
                        id: organizationId,
                        planTier: expectedTier,
                        planSource: 'stripe',
                        maxDevices: limits.maxDevices,
                        grantExpiresAt: null,
                        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
                        currentPeriodEnd: periodEnd,
                        subscriptionStatus: subscription.status,
                        ...(!org.stripeCustomerId ? { stripeCustomerId: subscription.customer as string } : {}),
                    });
                    await recordPlanAudit({
                        organizationId,
                        action: 'stripe-invoice-paid',
                        oldOrg: org,
                        newPlanTier: expectedTier,
                        newPlanSource: 'stripe',
                        newMaxSeats: limits.maxDevices,
                        newGrantExpiresAt: null,
                        reason: isPastDueRecovery
                            ? `Invoice paid and Stripe subscription ${subscription.id} is ${subscription.status}; restored paid access.`
                            : `Invoice paid and Stripe subscription ${subscription.id} is ${subscription.status}; reconciled plan state.`,
                    });
                }
            }
        } catch (err) {
            console.error(`[invoice.paid] Error verifying tier:`, err);
        }
    }

    console.log(`[invoice.paid] Processed for org ${organizationId}`);
};

const handleCustomerDeleted = async (customer: Stripe.Customer) => {
    console.log(`[customer.deleted] Processing customer: ${customer.id}`);

    const org = await getOrganizationByStripeCustomerId(customer.id);
    if (!org) {
        console.log(`[customer.deleted] No organization found with stripeCustomerId: ${customer.id}`);
        return;
    }

    if (org.planSource === 'stripe') {
        await updateOrgTier(
            org.id,
            null,
            'canceled',
            'stripe-customer-deleted',
            `Stripe customer ${customer.id} was deleted; revoked paid access and cleared customer link.`,
        );
    }

    await client.models.Organization.update({
        id: org.id,
        stripeCustomerId: null,
        planSource: org.planSource === 'stripe' ? null : org.planSource,
        ...(org.planSource === 'stripe' ? { subscriptionStatus: 'canceled' } : {}),
    });

    console.log(`[customer.deleted] Cleared stripeCustomerId from organization: ${org.id}`);
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export const handler = async (event: SQSEvent) => {
    console.log(`[paymentProcessor] Handler invoked with ${event.Records.length} records`);

    const batchItemFailures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        try {
            const { detail: stripeEvent } = JSON.parse(record.body) as { detail: Stripe.Event };
            console.log(`[paymentProcessor] Processing event: ${stripeEvent.type}`);
            console.log(JSON.stringify(stripeEvent));

            switch (stripeEvent.type) {
                case 'customer.subscription.trial_will_end':
                    await handleTrialWillEnd(stripeEvent.data.object as Stripe.Subscription);
                    break;

                case 'invoice.paid':
                    await handleInvoicePaid(stripeEvent.data.object as Stripe.Invoice);
                    break;

                case 'customer.subscription.updated':
                    await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
                    break;

                case 'customer.subscription.created':
                    await handleSubscriptionCreated(stripeEvent.data.object as Stripe.Subscription);
                    break;

                case 'customer.subscription.deleted':
                    await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
                    break;

                case 'customer.deleted':
                    await handleCustomerDeleted(stripeEvent.data.object as Stripe.Customer);
                    break;

                case 'invoice.payment_failed':
                    console.log(`[invoice.payment_failed] Payment failed — subscription will transition to past_due if retries exhaust`);
                    break;

                case 'checkout.session.completed':
                    console.log(`[checkout.session.completed] Received — handled by subscription events`);
                    break;

                default:
                    console.log(`[paymentProcessor] Unhandled event type: ${stripeEvent.type}`);
            }
        } catch (recordError) {
            console.error(`[paymentProcessor] Error processing record:`, {
                error: recordError,
                errorMessage: recordError instanceof Error ? recordError.message : 'Unknown error',
                errorStack: recordError instanceof Error ? recordError.stack : undefined,
                recordBody: record.body
            });
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures };
};
