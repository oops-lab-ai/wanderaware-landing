import { Link } from "react-router";

import { AlertTriangle, Bell, Building2, CreditCard, RadioTower, Tag, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSessionContext } from "@/contexts/session-context";
import { useCreateBillingPortal } from "@/hooks/use-mutations";
import { useOrganization } from "@/hooks/use-organization";
import { useUsage } from "@/hooks/use-usage";
import { getTierDisplayName } from "@/lib/plan-utils";

export default function OverviewPage() {
  const { userId, organization, membership } = useSessionContext();
  const { data: usage } = useUsage(organization.id);
  const { data: fullOrg } = useOrganization(organization.id);
  const portal = useCreateBillingPortal();

  const isOwner = membership.role === "owner";
  const isPastDue = fullOrg?.subscriptionStatus === "past_due" || fullOrg?.subscriptionStatus === "unpaid";
  const devicesUsed = usage?.seatsUsed ?? 3;
  const maxDevices = usage?.maxDevices ?? organization.maxDevices ?? 5;
  const devicePercent = maxDevices > 0 ? Math.min(100, (devicesUsed / maxDevices) * 100) : 0;

  function handleManageBilling() {
    portal.mutate(
      {
        userId,
        organizationId: organization.id,
        returnUrl: `${window.location.origin}/dashboard`,
      },
      {
        onSuccess: (result) => {
          if (result.url) window.location.href = result.url;
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">
            Selected building: {organization.name}. Review reader coverage, tag assignments, and alert activity.
          </p>
        </div>
        {isOwner && (
          <Button variant="outline" onClick={handleManageBilling} disabled={portal.isPending}>
            <CreditCard className="size-4" />
            {portal.isPending ? "Opening..." : "Manage Billing"}
          </Button>
        )}
      </div>

      {isPastDue && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-destructive" />
              <div>
                <p className="font-medium">Payment attention needed</p>
                <p className="text-muted-foreground text-sm">Update billing to keep device capacity active.</p>
              </div>
            </div>
            {isOwner && (
              <Button onClick={handleManageBilling} disabled={portal.isPending}>
                Update Payment
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Building Plan</CardTitle>
            <CreditCard className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="font-bold text-2xl">
                {organization.planTier ? getTierDisplayName(organization.planTier) : "Starter"}
              </span>
              <Badge variant={isPastDue ? "destructive" : "secondary"}>{isPastDue ? "Past due" : "Active"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Device Capacity</CardTitle>
            <RadioTower className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-2xl">{devicesUsed}</span>
              <span className="text-muted-foreground text-sm">/ {maxDevices}</span>
            </div>
            <Progress value={devicePercent} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Open Alerts</CardTitle>
            <Bell className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="font-bold text-2xl">1</span>
            <p className="text-muted-foreground text-sm">1 acknowledged today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Assigned Tags</CardTitle>
            <Tag className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="font-bold text-2xl">2</span>
            <p className="text-muted-foreground text-sm">1 unassigned tag ready</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Button asChild variant="outline" className="justify-start">
          <Link to="/buildings">
            <Building2 className="size-4" />
            Buildings
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link to="/devices">
            <RadioTower className="size-4" />
            Door Readers
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link to="/participants">
            <UsersRound className="size-4" />
            Participants
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link to="/alerts">
            <Bell className="size-4" />
            Alerts
          </Link>
        </Button>
      </div>
    </div>
  );
}
