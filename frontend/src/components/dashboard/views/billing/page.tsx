import { useEffect, useRef, useState } from "react";

import { Link, useSearchParams } from "react-router";

import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { PlanCard } from "@/components/dashboard/shared/plan-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionContext } from "@/contexts/session-context";
import {
  useCancelDowngrade,
  useChangePlan,
  useCreateBillingPortal,
  useCreateCheckoutSession,
} from "@/hooks/use-mutations";
import { useOrganization } from "@/hooks/use-organization";
import { useProducts } from "@/hooks/use-products";
import { useUsage } from "@/hooks/use-usage";
import { previewPlanChange } from "@/lib/amplify/data-client";
import type { SubscriptionProduct } from "@/lib/amplify/types";
import { getPlanDirection, getTierDisplayName } from "@/lib/plan-utils";

const BILLING_PLAN_SKELETON_KEYS = ["billing-plan-1", "billing-plan-2", "billing-plan-3"];

// ── URL param toast handler ────────────────────────────────────────────────

function useCheckoutToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (searchParams.get("success") === "true") {
      handled.current = true;
      toast.success("Subscription activated!");
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("canceled") === "true") {
      handled.current = true;
      toast("Checkout canceled");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
}

// ── Plan status badge ──────────────────────────────────────────────────────

function PlanStatusBadge({
  planTier,
  status,
  isCanceling,
  hasScheduledDowngrade,
  grantExpiresAt,
}: {
  planTier: string | null;
  status: string | null;
  isCanceling: boolean;
  hasScheduledDowngrade: boolean;
  grantExpiresAt: string | null;
}) {
  if (status === "trialing") {
    return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Trial</Badge>;
  }
  if (status === "past_due" || status === "unpaid") {
    return <Badge variant="destructive">Past Due</Badge>;
  }
  if (!planTier) return <Badge variant="outline">No Plan</Badge>;
  // Free-tier grant past its expiry: backend cleanup may not have run yet, surface
  // the state ourselves so the user knows they need to subscribe.
  if (planTier === "free" && grantExpiresAt && new Date(grantExpiresAt) < new Date()) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (isCanceling) return <Badge variant="destructive">Canceling</Badge>;
  if (hasScheduledDowngrade) return <Badge variant="outline">Downgrade Scheduled</Badge>;
  return <Badge variant="secondary">Active</Badge>;
}

// ── Billing page ───────────────────────────────────────────────────────────

export default function BillingPage() {
  const { userId, organization, membership, profile } = useSessionContext();
  const isOwner = membership.role === "owner";
  const { data: usage, isLoading: usageLoading } = useUsage(organization.id);
  const { data: productsData, isLoading: productsLoading } = useProducts();
  const { data: fullOrg } = useOrganization(organization.id);
  const checkout = useCreateCheckoutSession();
  const portal = useCreateBillingPortal();
  const changePlan = useChangePlan();
  const cancelDowngradeMut = useCancelDowngrade();

  useCheckoutToast();

  const products = productsData?.subscriptionProducts ?? [];
  // Free-tier orgs (from promo codes) have planTier='free' but NO Stripe
  // customer — they must go through Stripe Checkout to start a paid plan,
  // not the ChangePlan flow which modifies an existing subscription.
  const hasPaidPlan = !!fullOrg?.stripeCustomerId && !!organization.planTier && organization.planTier !== "free";
  // Trial eligibility is USER-LEVEL (Profile.hasUsedTrial), not org-level. Org-level
  // would let one user create unlimited orgs to claim unlimited 7-day trials. The
  // Profile flag is flipped to true by paymentProcessor on the user's first trialing
  // subscription anywhere across all their orgs.
  const eligibleForTrial = !hasPaidPlan && !profile.hasUsedTrial;
  const isCanceling = fullOrg?.cancelAtPeriodEnd === true;
  const isTrialing = fullOrg?.subscriptionStatus === "trialing";
  // past_due / unpaid means Stripe has tried to charge and the card declined. Our
  // paymentProcessor revokes access immediately (no grace period — by design). The user
  // sees a "Past Due" badge plus a recovery banner that opens the Stripe portal so they
  // can swap their card and Stripe can retry the open invoice.
  const isPastDue = fullOrg?.subscriptionStatus === "past_due" || fullOrg?.subscriptionStatus === "unpaid";
  const hasScheduledDowngrade = !!fullOrg?.scheduledDowngradeTier;
  const scheduledTier = fullOrg?.scheduledDowngradeTier;
  const cancelDate = fullOrg?.currentPeriodEnd
    ? new Date(fullOrg.currentPeriodEnd).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const downgradeDate = fullOrg?.scheduledDowngradeDate
    ? new Date(fullOrg.scheduledDowngradeDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  // Free-tier grant expired — backend cleanup may not have cleared `planTier` yet.
  // Surface the state so the user sees they need to subscribe.
  const grantExpired =
    organization.planTier === "free" && !!fullOrg?.grantExpiresAt && new Date(fullOrg.grantExpiresAt) < new Date();
  const grantEndDate = fullOrg?.grantExpiresAt
    ? new Date(fullOrg.grantExpiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  // Confirmation dialog state
  const [confirmProduct, setConfirmProduct] = useState<SubscriptionProduct | null>(null);
  const [previewData, setPreviewData] = useState<{
    prorationAmount: number;
    creditAmount: number;
    chargeAmount: number;
    direction: string;
    periodEnd: string | null;
    blocked: boolean;
    blockReason: string | null;
    seatsUsed: number | null;
    newTierMaxSeats: number | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const direction =
    confirmProduct?.tier && organization.planTier ? getPlanDirection(organization.planTier, confirmProduct.tier) : null;

  // Fetch proration preview when dialog opens. Now also runs on downgrade so the backend
  // can return a `blocked: true` envelope when the org has more active device device capacity
  // than the target tier supports — the dialog renders a different layout in that case
  // and disables the Confirm button.
  async function openConfirmDialog(product: SubscriptionProduct) {
    setConfirmProduct(product);
    setPreviewData(null);

    if (!product.priceId) return;

    const dir = product.tier && organization.planTier ? getPlanDirection(organization.planTier, product.tier) : null;

    if (dir === "upgrade" || dir === "downgrade") {
      setPreviewLoading(true);
      try {
        const preview = await previewPlanChange({
          organizationId: organization.id,
          newPriceId: product.priceId,
        });
        setPreviewData({
          prorationAmount: preview.prorationAmount ?? 0,
          creditAmount: preview.creditAmount ?? 0,
          chargeAmount: preview.chargeAmount ?? 0,
          direction: preview.direction ?? dir,
          periodEnd: preview.periodEnd ?? null,
          blocked: preview.blocked === true,
          blockReason: preview.blockReason ?? null,
          seatsUsed: preview.seatsUsed ?? null,
          newTierMaxSeats: preview.newTierMaxSeats ?? null,
        });
      } catch {
        // Preview failed — show dialog without proration amount. The submit-time guard
        // in changePlan will still surface a toast if the user proceeds anyway.
      } finally {
        setPreviewLoading(false);
      }
    }
  }

  function handleManageBilling() {
    portal.mutate(
      {
        userId,
        organizationId: organization.id,
        returnUrl: `${window.location.origin}/dashboard/billing`,
      },
      {
        onSuccess: (result) => {
          if (result.url) window.location.href = result.url;
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to open billing portal. Please try again.");
        },
      },
    );
  }

  function handleSelectPlan(product: SubscriptionProduct) {
    if (!product.id || !product.priceId) return;
    checkout.mutate(
      {
        productId: product.id,
        priceId: product.priceId,
        userId,
        organizationId: organization.id,
        successUrl: `${window.location.origin}/dashboard/billing?success=true`,
        cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        includeTrial: true,
      },
      {
        onSuccess: (result) => {
          if (result.url) window.location.href = result.url;
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to start checkout. Please try again.");
        },
      },
    );
  }

  function handleConfirmChangePlan() {
    if (!confirmProduct?.priceId) return;
    changePlan.mutate(
      { organizationId: organization.id, newPriceId: confirmProduct.priceId },
      {
        onSuccess: (result) => {
          const tierName = result.newTier
            ? getTierDisplayName(result.newTier)
            : confirmProduct?.tier
              ? getTierDisplayName(confirmProduct.tier)
              : confirmProduct?.name;
          setConfirmProduct(null);
          setPreviewData(null);
          toast.success(result.message ?? `Plan changed to ${tierName}`);
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to change plan. Please try again.");
        },
      },
    );
  }

  function handleCancelDowngrade() {
    cancelDowngradeMut.mutate(
      { organizationId: organization.id },
      {
        onSuccess: (result) => {
          toast.success(result.message ?? "Pending downgrade cancelled.");
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to cancel downgrade. Please try again.");
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Manage the plan, device capacity, and Stripe billing for {organization.name}.
        </p>
      </div>

      {/* Current plan section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>Current Building Plan</CardTitle>
            </div>
          </div>
          {isOwner && fullOrg?.stripeCustomerId && (
            <Button variant="outline" onClick={handleManageBilling} disabled={portal.isPending}>
              <ExternalLink className="size-4" />
              {portal.isPending ? "Opening..." : "Manage Billing"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-6 w-20" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Use the marketing display name ("Team") not the internal tier id
                  ("professional"). The capitalize utility was masking the leak. */}
              <span className="font-bold text-3xl">
                {isPastDue ? "Suspended" : usage?.planTier ? getTierDisplayName(usage.planTier) : "No Plan"}
              </span>
              {/* When there's no plan the heading already says "No Plan"; an "outline No Plan"
                  badge next to it is redundant. Only show the badge for any non-default state. */}
              {(usage?.planTier || isPastDue) && (
                <PlanStatusBadge
                  planTier={usage?.planTier ?? null}
                  status={fullOrg?.subscriptionStatus ?? null}
                  isCanceling={isCanceling}
                  hasScheduledDowngrade={hasScheduledDowngrade}
                  grantExpiresAt={fullOrg?.grantExpiresAt ?? null}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past-due recovery banner — access is already revoked at this point; this CTA
          opens the Stripe portal so the user can update their card. Stripe will retry the
          open invoice on the new card and re-grant access via the active webhook. */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              <strong>Subscription suspended due to a failed payment.</strong> Update your payment method to restore
              access immediately. Your plan and team data are preserved.
            </span>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portal.isPending}>
                {portal.isPending ? "Opening..." : "Update Payment Method"}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation banner */}
      {isCanceling && cancelDate && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Your plan cancels on <strong>{cancelDate}</strong>. You'll retain access until then.
            </span>
            {isOwner && (
              <Button variant="link" size="sm" onClick={handleManageBilling} disabled={portal.isPending}>
                {portal.isPending ? "Opening..." : "Reactivate"}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Scheduled downgrade banner */}
      {hasScheduledDowngrade && scheduledTier && downgradeDate && !isCanceling && (
        <Alert>
          <ArrowDown className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Downgrade to <strong className="capitalize">{getTierDisplayName(scheduledTier)}</strong> scheduled for{" "}
              <strong>{downgradeDate}</strong>. Your current plan continues until then.
            </span>
            {isOwner && (
              <Button variant="link" size="sm" onClick={handleCancelDowngrade} disabled={cancelDowngradeMut.isPending}>
                {cancelDowngradeMut.isPending ? "Canceling..." : "Cancel Downgrade"}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Free-tier grant expired banner */}
      {grantExpired && grantEndDate && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Your plan grant grant ended on <strong>{grantEndDate}</strong>. Subscribe to a paid plan to continue using
            the WanderAware dashboard.
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Non-owner: just an explanatory alert. We hide the plan-cards grid entirely
          for viewers because silently-non-clickable cards are worse UX than having
          no cards at all. The Current Plan card above already shows what the org
          is on; that's the only billing info a viewer needs. */}
      {!isOwner && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Only the building owner can manage billing or change plans. Contact your owner to upgrade or modify this
            building plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Plan cards section — owners only */}
      {isOwner && (
        <div>
          <h2 className="mb-4 font-semibold text-lg">
            {hasPaidPlan ? "Available Building Plans" : "Choose a Building Plan"}
          </h2>
          {productsLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {BILLING_PLAN_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-80 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {products.map((product) => {
                const isCurrent = hasPaidPlan && product.tier === organization.planTier;
                const planDir =
                  hasPaidPlan && product.tier && organization.planTier
                    ? getPlanDirection(organization.planTier, product.tier)
                    : null;

                let actionLabel: string | undefined;
                if (hasPaidPlan && !isCurrent && planDir) {
                  actionLabel = planDir === "upgrade" ? "Upgrade" : "Downgrade";
                }

                return (
                  <PlanCard
                    key={product.priceId}
                    product={product}
                    isCurrentPlan={isCurrent}
                    actionLabel={actionLabel}
                    eligibleForTrial={eligibleForTrial}
                    onSelect={() => {
                      if (hasPaidPlan) {
                        openConfirmDialog(product);
                      } else {
                        handleSelectPlan(product);
                      }
                    }}
                    isLoading={hasPaidPlan ? changePlan.isPending : checkout.isPending}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation dialog for plan changes */}
      <AlertDialog
        open={!!confirmProduct}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmProduct(null);
            setPreviewData(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {direction === "upgrade" ? (
                <ArrowUp className="size-5 text-green-500" />
              ) : (
                <ArrowDown className="size-5 text-orange-500" />
              )}
              {direction === "upgrade" ? "Upgrade" : "Downgrade"} to{" "}
              {confirmProduct?.tier ? getTierDisplayName(confirmProduct.tier) : confirmProduct?.name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="w-full space-y-3">
                {direction === "upgrade" ? (
                  <>
                    <p>
                      You'll be upgraded to <strong>{confirmProduct?.name}</strong> at{" "}
                      <strong>
                        ${confirmProduct?.price}/{confirmProduct?.interval}
                      </strong>
                      .
                    </p>
                    {previewLoading ? (
                      <div className="rounded-lg border p-3">
                        <Skeleton className="h-5 w-48" />
                      </div>
                    ) : previewData ? (
                      isTrialing ? (
                        // Trial-preserving upgrade: nothing due today, new price kicks in at trial_end.
                        <div className="w-full space-y-2 rounded-lg border bg-muted/50 p-4 text-sm">
                          <div className="flex justify-between">
                            <span>Free trial continues until</span>
                            <strong>
                              {previewData.periodEnd
                                ? new Date(previewData.periodEnd).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "trial end"}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>First charge</span>
                            <strong>${confirmProduct?.price}.00</strong>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Due today</span>
                            <span>$0.00</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full space-y-3 rounded-lg border bg-muted/50 p-4 text-sm">
                          {/* Show the prorated charge (chargeAmount), NOT the full monthly
                              price — otherwise line items don't add up to "Total due today".
                              Stripe computes the proration with second-precision so the values
                              naturally reconcile only when we use chargeAmount + creditAmount. */}
                          <div className="flex justify-between">
                            <div>
                              <div className="font-medium">{confirmProduct?.name} subscription</div>
                              <div className="text-muted-foreground text-xs">
                                Prorated for the rest of this billing period
                              </div>
                            </div>
                            <span className="font-medium">${previewData.chargeAmount.toFixed(2)}</span>
                          </div>
                          {previewData.creditAmount < 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <div>
                                <div>Adjustment</div>
                                <div className="text-xs">
                                  Prorated credit for your{" "}
                                  {organization.planTier ? getTierDisplayName(organization.planTier) : "current"}{" "}
                                  subscription
                                </div>
                              </div>
                              <span className="text-green-600">-${Math.abs(previewData.creditAmount).toFixed(2)}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Total due today</span>
                            <span>${previewData.prorationAmount.toFixed(2)}</span>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Then ${confirmProduct?.price}/mo starting{" "}
                            {previewData.periodEnd
                              ? new Date(previewData.periodEnd).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "next cycle"}
                          </div>
                        </div>
                      )
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {isTrialing
                        ? "New plan applies immediately. Your trial continues uninterrupted."
                        : "Upgrade takes effect immediately."}
                    </p>
                  </>
                ) : previewData?.blocked ? (
                  <>
                    <p>
                      You'd like to downgrade to <strong>{confirmProduct?.name}</strong>, but this building has more
                      active device capacity than that plan supports.
                    </p>
                    <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm">
                      <div className="font-medium text-destructive">Downgrade blocked</div>
                      <p className="text-foreground">{previewData.blockReason}</p>
                      {previewData.seatsUsed !== null && previewData.newTierMaxSeats !== null && (
                        <div className="flex justify-between text-muted-foreground text-xs">
                          <span>Active device capacity</span>
                          <span>
                            <strong className="text-destructive">{previewData.seatsUsed}</strong> used /{" "}
                            <strong>{previewData.newTierMaxSeats}</strong> allowed on {confirmProduct?.name}
                          </span>
                        </div>
                      )}
                      <Button asChild size="sm" className="w-fit">
                        <Link to="/devices">Manage Device Capacity</Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      You'll be downgraded to <strong>{confirmProduct?.name}</strong> at{" "}
                      <strong>
                        ${confirmProduct?.price}/{confirmProduct?.interval}
                      </strong>
                      .
                    </p>
                    <div className="space-y-1 rounded-lg border bg-muted/50 p-3 text-sm">
                      <div className="flex justify-between">
                        <span>Current plan continues until</span>
                        <strong>{cancelDate ?? "end of billing period"}</strong>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>New rate starting then</span>
                        <span>${confirmProduct?.price}/mo</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      No proration. You keep your current plan until the billing period ends.
                    </p>
                  </>
                )}
                {hasScheduledDowngrade && (
                  <p className="text-muted-foreground text-xs">This will replace your existing scheduled downgrade.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changePlan.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmChangePlan}
              disabled={changePlan.isPending || previewLoading || previewData?.blocked === true}
            >
              {changePlan.isPending
                ? "Processing..."
                : direction === "upgrade"
                  ? isTrialing
                    ? "Confirm Upgrade"
                    : `Confirm Upgrade${previewData ? ` — $${previewData.prorationAmount.toFixed(2)}` : ""}`
                  : "Confirm Downgrade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
