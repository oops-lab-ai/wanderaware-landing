import { useEffect, useState } from "react";

import { Link, Navigate, useParams } from "react-router";

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAdminGetOrg,
  useAdminReleaseOrgDevice,
  useAdminRemoveOrgMember,
  useAdminRestoreOrg,
  useAdminSearchOrgs,
  useAdminUpdateGrant,
  useAdminUpdateOrgMemberRole,
  useAdminUpdateOrgPlan,
} from "@/hooks/use-admin";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { AdminOrgSearchItem } from "@/lib/amplify/data-client";

const PLAN_OPTIONS = [
  { value: "free", label: "Granted", defaultSeats: 1 },
  { value: "basic", label: "Starter", defaultSeats: 1 },
  { value: "professional", label: "Professional", defaultSeats: 5 },
  { value: "enterprise", label: "Enterprise", defaultSeats: 999999 },
];

type OrgFilter = "all" | "active-stripe" | "stripe" | "grants" | "manual" | "deleted" | "missing-owner";

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function planBadge(org: {
  planTier?: string | null;
  planSource?: string | null;
  subscriptionStatus?: string | null;
  deletedAt?: string | null;
}) {
  if (org.deletedAt) return <Badge variant="destructive">Deleted</Badge>;
  if (org.planSource === "grant")
    return <Badge className="bg-blue-100 text-blue-700">{org.planTier ?? "grant"} grant</Badge>;
  if (org.planSource === "manual")
    return <Badge className="bg-purple-100 text-purple-700">{org.planTier ?? "manual"} manual</Badge>;
  if (org.planTier) return <Badge className="bg-emerald-100 text-emerald-700">{org.planTier}</Badge>;
  if (org.subscriptionStatus) return <Badge variant="secondary">{org.subscriptionStatus}</Badge>;
  return <Badge variant="secondary">No plan</Badge>;
}

function hasActiveStripeSubscription(org: AdminOrgSearchItem): boolean {
  return !!org.stripeCustomerId && ACTIVE_STRIPE_STATUSES.has((org.subscriptionStatus ?? "").toLowerCase());
}

function subscriptionBadge(org: AdminOrgSearchItem) {
  if (hasActiveStripeSubscription(org)) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700" title={org.stripeCustomerId ?? undefined}>
        Stripe {org.subscriptionStatus}
      </Badge>
    );
  }
  if (org.stripeCustomerId) {
    return (
      <Badge variant="outline" title={org.stripeCustomerId}>
        Stripe {org.subscriptionStatus ?? "customer"}
      </Badge>
    );
  }
  return <span className="text-muted-foreground">-</span>;
}

function defaultSeatsForPlan(planTier: string) {
  return PLAN_OPTIONS.find((option) => option.value === planTier)?.defaultSeats ?? 1;
}

function TruncatedValue({ value, className }: { value: string; className?: string }) {
  return (
    <div className={className} title={value}>
      {value}
    </div>
  );
}

function OrgSearchView() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<OrgFilter>("all");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useAdminSearchOrgs(debounced);
  const organizations = (data?.organizations ?? []).filter((org) => {
    if (filter === "active-stripe") return hasActiveStripeSubscription(org);
    if (filter === "stripe") return !!org.stripeCustomerId;
    if (filter === "grants") return org.planSource === "grant";
    if (filter === "manual") return org.planSource === "manual";
    if (filter === "deleted") return !!org.deletedAt;
    if (filter === "missing-owner") return !!org.ownerId && !org.ownerEmail;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <Building2 className="size-6" />
          Organizations
        </h1>
        <p className="text-muted-foreground text-sm">
          Search every organization, including paid Stripe orgs, free grants, and soft-deleted records.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by org name, owner email, or exact org id..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as OrgFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All orgs</SelectItem>
                <SelectItem value="active-stripe">Active Stripe</SelectItem>
                <SelectItem value="stripe">All Stripe</SelectItem>
                <SelectItem value="grants">Admin grants</SelectItem>
                <SelectItem value="manual">Manual overrides</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
                <SelectItem value="missing-owner">Missing owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-muted-foreground text-xs">Leave blank to list the first 50 organizations.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No organizations found.</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[27%]">Organization</TableHead>
                  <TableHead className="w-[16%]">Owner</TableHead>
                  <TableHead className="w-[13%]">Plan</TableHead>
                  <TableHead className="w-[18%]">Subscription</TableHead>
                  <TableHead className="w-[8%]">Seats</TableHead>
                  <TableHead className="w-[6%]">Members</TableHead>
                  <TableHead className="w-[12%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org: AdminOrgSearchItem) => (
                  <TableRow key={org.organizationId}>
                    <TableCell className="min-w-0">
                      <TruncatedValue value={org.name ?? org.organizationId} className="truncate font-medium" />
                      <TruncatedValue
                        value={org.organizationId}
                        className="truncate font-mono text-muted-foreground text-xs"
                      />
                    </TableCell>
                    <TableCell className="min-w-0 text-sm">
                      {org.ownerEmail ? (
                        <TruncatedValue value={org.ownerEmail} className="truncate" />
                      ) : org.ownerId ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="gap-1 text-amber-700">
                            <AlertTriangle className="size-3" />
                            Missing profile
                          </Badge>
                          <TruncatedValue
                            value={org.ownerId}
                            className="truncate font-mono text-muted-foreground text-xs"
                          />
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="min-w-0">{planBadge(org)}</TableCell>
                    <TableCell className="min-w-0 text-sm">{subscriptionBadge(org)}</TableCell>
                    <TableCell className="text-sm">
                      {org.seatsUsed ?? 0} / {org.maxDevices ?? 0}
                    </TableCell>
                    <TableCell className="text-sm">{org.memberCount ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/orgs/${org.organizationId}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrgDetailView({ organizationId }: { organizationId: string }) {
  const { data, isLoading, refetch } = useAdminGetOrg(organizationId);
  const updateGrant = useAdminUpdateGrant();
  const updatePlan = useAdminUpdateOrgPlan();
  const updateRole = useAdminUpdateOrgMemberRole();
  const removeMember = useAdminRemoveOrgMember();
  const releaseDevice = useAdminReleaseOrgDevice();
  const restoreOrg = useAdminRestoreOrg();
  const [customExpiry, setCustomExpiry] = useState("");
  const [planDraft, setPlanDraft] = useState("free");
  const [planSourceDraft, setPlanSourceDraft] = useState("manual");
  const [seatDraft, setSeatDraft] = useState("1");
  const [grantExpiryDraft, setGrantExpiryDraft] = useState("");
  const [planReason, setPlanReason] = useState("");

  useEffect(() => {
    const org = data?.organization;
    if (!org) return;
    const nextPlan = org.planTier ?? "free";
    setPlanDraft(nextPlan);
    setPlanSourceDraft(org.planSource === "grant" ? "grant" : "manual");
    setSeatDraft(String(org.maxDevices ?? defaultSeatsForPlan(nextPlan)));
    setGrantExpiryDraft(org.grantExpiresAt ? org.grantExpiresAt.slice(0, 10) : "");
  }, [data?.organization]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const org = data?.organization;
  if (!org) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to="/admin/orgs">
            <ArrowLeft className="size-4" />
            Back to organizations
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">Organization not found.</CardContent>
        </Card>
      </div>
    );
  }

  const isGrantOrg = org.planSource === "grant";
  const isPaidOrg = !!org.stripeCustomerId && org.planTier !== "free";
  const canEditPlan = !org.stripeCustomerId && !org.deletedAt;
  const seatDraftNumber = Number.parseInt(seatDraft, 10);
  const plannedRevocations = Number.isFinite(seatDraftNumber) ? Math.max(0, (org.seatsUsed ?? 0) - seatDraftNumber) : 0;

  async function runAction(label: string, fn: () => Promise<{ success: boolean | null; message: string | null }>) {
    try {
      const result = await fn();
      if (result.success) {
        toast.success(result.message ?? `${label} succeeded`);
        await refetch();
      } else {
        toast.error(result.message ?? `${label} failed`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-2 w-fit">
          <Link to="/admin/orgs">
            <ArrowLeft className="size-4" />
            Back to organizations
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
              <Building2 className="size-6" />
              <span className="truncate" title={org.name ?? org.id}>
                {org.name ?? org.id}
              </span>
            </h1>
            <p className="break-all font-mono text-muted-foreground text-xs">{org.id}</p>
          </div>
          {planBadge(org)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>{org.planTier ?? "No plan"}</div>
            <div className="text-muted-foreground">Source: {org.planSource ?? "-"}</div>
            <div className="text-muted-foreground">Status: {org.subscriptionStatus ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Seats</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {org.seatsUsed ?? 0} used / {org.maxDevices ?? 0} max
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Grant</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{org.grantExpiresAt ? formatDate(org.grantExpiresAt) : "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm">Stripe</CardTitle>
          </CardHeader>
          <CardContent className="break-all font-mono text-xs">{org.stripeCustomerId ?? "-"}</CardContent>
        </Card>
      </div>

      {org.scheduledDowngradeTier && (
        <Card className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="flex min-h-0 flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <CalendarClock className="size-4 text-blue-700 dark:text-blue-300" />
            <div>
              <span className="font-medium">Scheduled downgrade:</span> {org.planTier ?? "current plan"} {"->"}{" "}
              {org.scheduledDowngradeTier} on {formatDate(org.scheduledDowngradeDate)}.
            </div>
          </CardContent>
        </Card>
      )}

      {isPaidOrg && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="min-h-0 px-4 py-3 text-sm">
            Paid Stripe orgs are read-only here. Use Stripe/billing workflows for subscription changes.
          </CardContent>
        </Card>
      )}

      {canEditPlan && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Admin plan override</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[180px_180px_140px_170px_auto]">
            <Select
              value={planDraft}
              onValueChange={(value) => {
                setPlanDraft(value);
                setSeatDraft(String(defaultSeatsForPlan(value)));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={planSourceDraft} onValueChange={setPlanSourceDraft}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual override</SelectItem>
                <SelectItem value="grant">Grant</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              step={1}
              value={seatDraft}
              onChange={(event) => setSeatDraft(event.target.value)}
              aria-label="Max device slots"
            />
            <Input
              type="date"
              value={grantExpiryDraft}
              onChange={(event) => setGrantExpiryDraft(event.target.value)}
              aria-label="Grant expiry"
              disabled={planSourceDraft !== "grant"}
            />
            <Button
              className="w-fit"
              disabled={updatePlan.isPending}
              onClick={() =>
                runAction("Update plan", () =>
                  updatePlan.mutateAsync({
                    organizationId: org.id,
                    planTier: planDraft,
                    planSource: planSourceDraft,
                    maxDevices: seatDraftNumber,
                    grantExpiresAt:
                      planSourceDraft === "grant" && grantExpiryDraft ? new Date(grantExpiryDraft).toISOString() : null,
                    reason: planReason || undefined,
                  }),
                )
              }
            >
              {updatePlan.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Save plan
            </Button>
            <Input
              className="md:col-span-5"
              value={planReason}
              onChange={(event) => setPlanReason(event.target.value)}
              placeholder="Optional internal reason"
              aria-label="Plan change reason"
            />
            <p className="text-muted-foreground text-xs md:col-span-5">
              Only non-Stripe organizations can be edited here. Stripe-backed organizations stay read-only so billing
              and licensing do not drift apart.
            </p>
            {plannedRevocations > 0 && (
              <p className="text-amber-700 text-xs md:col-span-5">
                Saving this plan will revoke {plannedRevocations} active device slot
                {plannedRevocations === 1 ? "" : "s"} newest-first. If at least one slot remains, the owner&apos;s
                oldest device is preserved.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {org.deletedAt && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deleted organization</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">Deleted {formatDate(org.deletedAt)}.</p>
            <Button
              variant="outline"
              onClick={() => runAction("Restore organization", () => restoreOrg.mutateAsync(org.id))}
              disabled={restoreOrg.isPending}
            >
              {restoreOrg.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              Restore
            </Button>
          </CardContent>
        </Card>
      )}

      {isGrantOrg && !org.deletedAt && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Grant controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                runAction("Extend grant", () =>
                  updateGrant.mutateAsync({ organizationId: org.id, action: "extend", extensionDays: 30 }),
                )
              }
              disabled={updateGrant.isPending}
            >
              <RefreshCw className="size-4" />
              Extend 30 days
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runAction("Make permanent", () =>
                  updateGrant.mutateAsync({ organizationId: org.id, action: "permanent" }),
                )
              }
              disabled={updateGrant.isPending}
            >
              Make permanent
            </Button>
            <Button variant="outline" onClick={() => setCustomExpiry(new Date().toISOString().slice(0, 10))}>
              Set custom expiry
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={updateGrant.isPending}>
                  <Trash2 className="size-4" />
                  Revoke
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke this grant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Web sessions lose pland access on their next validation check.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      runAction("Revoke grant", () =>
                        updateGrant.mutateAsync({ organizationId: org.id, action: "revoke" }),
                      )
                    }
                  >
                    Revoke grant
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan audit log ({data?.auditLog?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.auditLog?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm">No plan changes recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Grant expiry</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.auditLog?.map((entry) => (
                  <TableRow key={entry.id ?? `${entry.action}-${entry.createdAt}`}>
                    <TableCell className="text-sm">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell className="text-sm">{entry.action ?? "-"}</TableCell>
                    <TableCell className="text-sm">
                      {entry.oldPlanTier ?? "-"} {"->"} {entry.newPlanTier ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.oldPlanSource ?? "-"} {"->"} {entry.newPlanSource ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.oldMaxSeats ?? "-"} {"->"} {entry.newMaxSeats ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(entry.oldGrantExpiresAt)} {"->"} {formatDate(entry.newGrantExpiresAt)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-sm" title={entry.reason ?? undefined}>
                      {entry.reason ?? "-"}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {entry.actorUserId ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Members ({data?.members.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.members.map((member) => (
                  <TableRow key={member.membershipId ?? member.userId}>
                    <TableCell>{member.email ?? "-"}</TableCell>
                    <TableCell>
                      {member.role === "owner" || !member.membershipId ? (
                        <Badge variant="secondary">{member.role ?? "-"}</Badge>
                      ) : (
                        <Select
                          value={member.role ?? "viewer"}
                          onValueChange={(role) =>
                            runAction("Update role", () =>
                              updateRole.mutateAsync({
                                organizationId: org.id,
                                membershipId: member.membershipId ?? "",
                                role,
                              }),
                            )
                          }
                        >
                          <SelectTrigger size="sm" className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      <Link to={`/admin/users/${member.userId}`} className="hover:underline">
                        {member.userId ?? "-"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== "owner" && member.membershipId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <UserMinus className="size-4" />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes {member.email ?? member.userId} from the organization and releases their
                                device capacity.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  runAction("Remove member", () =>
                                    removeMember.mutateAsync({
                                      organizationId: org.id,
                                      membershipId: member.membershipId ?? "",
                                    }),
                                  )
                                }
                              >
                                Remove member
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Devices ({data?.devices.length ?? 0})</CardTitle>
          <p className="text-muted-foreground text-xs">
            Shown newest first. Downgrades revoke newest device slots first while preserving the owner&apos;s oldest
            device when at least one slot remains.
          </p>
        </CardHeader>
        <CardContent>
          {data?.devices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active device capacity.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead>Last validation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.devices.map((device) => (
                  <TableRow key={`${device.userId}-${device.deviceId}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HardDrive className="size-4 text-muted-foreground" />
                        <span>{device.deviceName ?? "Web"}</span>
                      </div>
                      <div className="font-mono text-muted-foreground text-xs">{device.deviceId}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{device.userId ?? "-"}</TableCell>
                    <TableCell className="text-sm">{formatDate(device.activatedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(device.lastValidatedAt)}</TableCell>
                    <TableCell className="text-right">
                      {device.userId && device.deviceId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="size-4" />
                              Release
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Release this device slot?</AlertDialogTitle>
                              <AlertDialogDescription>
                                The device will need to claim capacity again before planned web use continues.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  runAction("Release device", () =>
                                    releaseDevice.mutateAsync({
                                      organizationId: org.id,
                                      userId: device.userId ?? "",
                                      deviceId: device.deviceId ?? "",
                                    }),
                                  )
                                }
                              >
                                Release device
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!customExpiry} onOpenChange={(open) => !open && setCustomExpiry("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set custom grant expiry</DialogTitle>
          </DialogHeader>
          <Input type="date" value={customExpiry} onChange={(e) => setCustomExpiry(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomExpiry("")}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const date = new Date(customExpiry).toISOString();
                runAction("Set custom expiry", () =>
                  updateGrant.mutateAsync({ organizationId: org.id, action: "set-custom", customExpiresAt: date }),
                );
                setCustomExpiry("");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminOrgsPage() {
  const { organizationId } = useParams<{ organizationId?: string }>();
  const { isAdmin, isChecking } = useIsAdmin();

  if (isChecking) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (organizationId) {
    return <OrgDetailView organizationId={organizationId} />;
  }
  return <OrgSearchView />;
}
