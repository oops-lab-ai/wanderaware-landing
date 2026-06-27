import { useEffect, useState } from "react";

import { Navigate, useNavigate } from "react-router";

import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "aws-amplify/auth";
import { Building2, Check, Command, Inbox, Loader2, LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoleculeLoader } from "@/components/ui/molecule-loader";
import { APP_CONFIG } from "@/config/app-config";
import { useAuth } from "@/hooks/use-auth";
import { useMyInvitations } from "@/hooks/use-invitations";
import { useAcceptInvitation, useCreateOrganization, useDeclineInvitation } from "@/hooks/use-mutations";
import { clearActiveOrgForUser, setActiveOrgId, setActiveUser } from "@/lib/active-org-id";
import { capitalize, formatDate, roleBadgeVariant } from "@/lib/dashboard-utils";
import { MAX_ORGANIZATION_NAME_LENGTH, normalizeOrganizationName } from "@/lib/organization-name";

/**
 * Zero-org landing page. AuthGuard routes the user here whenever
 * `auth.data.organizations.length === 0` — i.e. fresh signups whose
 * postConfirmation trigger hasn't fired yet, or users who just deleted/left
 * their last org.
 *
 * IMPORTANT: this route is wired OUTSIDE the AuthGuard wrapper. AuthGuard
 * checks zero-org and redirects HERE; if /welcome were inside AuthGuard, the
 * redirect would loop infinitely.
 *
 * Three sections + auto-redirect:
 *   • Pending Invitations card — accept any invite to land on the new org
 *   • Create Organization card — make a new workspace
 *   • Logout button — clears just this user's active-org pointer
 *
 * Auto-redirect: if the user gains an org while sitting here (e.g. accepted
 * an invite in another tab, or postConfirmation finally fired), bounce to /
 * which AuthGuard then renders normally.
 */
export default function WelcomePage() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Auto-redirect when an org appears. AuthGuard will pick the active org and
  // render the dashboard. Note: useMyInvitations refetchOnWindowFocus + the
  // invalidation hooks keep auth fresh — no manual polling needed here.
  useEffect(() => {
    if (auth.data && auth.data.organizations.length > 0) {
      navigate("/", { replace: true });
    }
  }, [auth.data, navigate]);

  if (auth.isLoading) return <MoleculeLoader />;

  // Not authenticated at all → /login. AuthGuard would normally handle this,
  // but /welcome lives outside it.
  if (auth.error || !auth.data) {
    return <Navigate to="/login" replace />;
  }

  // Effect above will navigate; render nothing in the meantime to avoid a
  // one-frame flash of the welcome UI.
  if (auth.data.organizations.length > 0) return null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Command className="size-5" />
            <span className="font-semibold text-lg">{APP_CONFIG.name}</span>
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Welcome, {auth.data.email}</h1>
          <p className="text-muted-foreground text-sm">
            You're not in any organization yet. Accept a pending invitation, or start your own workspace.
          </p>
        </div>

        <PendingInvitationsCard userId={auth.data.userId} />
        <CreateOrganizationCard userId={auth.data.userId} />

        <div className="flex justify-center">
          <LogoutButton userId={auth.data.userId} />
        </div>
      </div>
    </main>
  );
}

// ── Pending Invitations ────────────────────────────────────────────────────

function PendingInvitationsCard({ userId }: { userId: string }) {
  const { data, isLoading } = useMyInvitations();
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const invitations = data?.invitations ?? [];

  // The /welcome variant intentionally renders the empty state too, so users
  // know "there are no invites for me" instead of just seeing the create-org
  // card alone. The team-page MyInvitationsCard is the opposite — it hides
  // when empty so the team page stays uncluttered.
  const handleAccept = (tokenHash: string, orgName: string) => {
    acceptMutation.mutate(
      { token: tokenHash },
      {
        onSuccess: (result) => {
          if (result.success && result.organizationId) {
            // setActiveUser first so setActiveOrgId can persist to the per-user map.
            // useSession isn't mounted on /welcome, so its useEffect hasn't set activeUserId yet.
            setActiveUser(userId);
            setActiveOrgId(result.organizationId);
            toast.success(`Joined ${orgName}!`);
            // Wipe auth cache + navigate directly instead of waiting for the
            // auto-redirect effect. Without this, the welcome page sits idle
            // for a few seconds between toast and redirect while the background
            // refetch runs — same frozen-UI pattern we fixed on create-org.
            queryClient.removeQueries({ queryKey: ["auth"] });
            navigate("/", { replace: true });
          } else {
            toast.error(result.message ?? "Failed to accept invitation");
          }
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to accept invitation");
        },
      },
    );
  };

  const handleDecline = (tokenHash: string) => {
    declineMutation.mutate(
      { token: tokenHash },
      {
        onSuccess: () => {
          toast.success("Invitation declined");
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to decline invitation");
        },
      },
    );
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          Pending Invitations
          {invitations.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground">
              {invitations.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>Organizations that have invited you to join</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Checking for invitations…</p>
        ) : invitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending invitations.</p>
        ) : (
          invitations.map((inv) => (
            <div
              key={inv.tokenHash}
              className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{inv.organizationName ?? "Unnamed organization"}</span>
                  <Badge variant={roleBadgeVariant(inv.role)}>{capitalize(inv.role)}</Badge>
                </div>
                <p className="truncate text-muted-foreground text-xs">
                  Invited by {inv.inviterEmail ?? "a team member"} · {formatDate(inv.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inv.tokenHash && handleDecline(inv.tokenHash)}
                  disabled={declineMutation.isPending || acceptMutation.isPending}
                >
                  <X className="size-4" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => inv.tokenHash && handleAccept(inv.tokenHash, inv.organizationName ?? "organization")}
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Accept
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Create Organization ────────────────────────────────────────────────────

function CreateOrganizationCard({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const createOrg = useCreateOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleCreate = async () => {
    const trimmed = normalizeOrganizationName(name);
    if (!trimmed) {
      toast.error("Please enter an organization name");
      return;
    }
    try {
      const result = await createOrg.mutateAsync({ name: trimmed });
      if (result.organizationId) {
        setActiveUser(userId);
        setActiveOrgId(result.organizationId);
        toast.success(`Created ${trimmed}`);
        // Remove the cache so AuthGuard enters loading state immediately —
        // same pattern as delete/leave. Without this the welcome page sits
        // idle while a background refetch runs, which feels frozen.
        queryClient.removeQueries({ queryKey: ["auth"] });
        navigate("/", { replace: true });
      } else {
        toast.error("Could not create organization");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create organization");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" />
          Start your own
        </CardTitle>
        <CardDescription>Create a new workspace and become its owner</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="welcome-org-name">Organization name</Label>
          <Input
            id="welcome-org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Care Center"
            maxLength={MAX_ORGANIZATION_NAME_LENGTH}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            disabled={createOrg.isPending}
          />
          <p className="text-muted-foreground text-xs">
            {name.length}/{MAX_ORGANIZATION_NAME_LENGTH} characters
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createOrg.isPending} className="w-full">
          {createOrg.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Create Organization
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Logout ──────────────────────────────────────────────────────────────────

function LogoutButton({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      // Clear ONLY this user's stored org pick. Other users on a shared
      // browser keep their picks intact.
      clearActiveOrgForUser(userId);
      await signOut();
      queryClient.clear();
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-out failed");
      setSigningOut(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={signingOut}>
      {signingOut ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogOut className="mr-2 size-4" />}
      Sign out
    </Button>
  );
}
