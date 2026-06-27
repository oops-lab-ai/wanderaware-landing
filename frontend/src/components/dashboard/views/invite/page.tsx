import { useEffect, useState } from "react";

import { Link, useNavigate, useSearchParams } from "react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "aws-amplify/auth";
import { AlertTriangle, Clock, Command, Loader2, Mail, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_CONFIG } from "@/config/app-config";
import { useAcceptInvitation, useDeclineInvitation } from "@/hooks/use-mutations";
import { setActiveOrgId, setActiveUser } from "@/lib/active-org-id";
import { getInvitationDetails } from "@/lib/amplify/data-client";

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  // This page lives outside AuthGuard so useSession never mounts — we have to
  // fetch the Cognito sub ourselves to wire setActiveUser before setActiveOrgId.
  const [userId, setUserId] = useState<string | null>(null);

  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  // Check auth status
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setIsLoggedIn(true);
        setUserId(u.userId);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Fetch invitation details (no auth needed)
  const {
    data: invitation,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => {
      if (!token) throw new Error("Invitation token is required");
      return getInvitationDetails(token);
    },
    enabled: !!token,
  });

  function handleAccept() {
    if (!token) return;
    acceptMutation.mutate(
      { token },
      {
        onSuccess: (result) => {
          if (result.success && result.organizationId) {
            // Wire the per-user active-user *before* setting the org, otherwise
            // the setter silently drops the write (no active user → no persist).
            if (userId) setActiveUser(userId);
            setActiveOrgId(result.organizationId);
            toast.success(`Joined ${invitation?.organizationName ?? "building"}!`);
            // Wipe auth cache so AuthGuard flashes MoleculeLoader instead of
            // showing stale pre-accept data during the background refetch.
            queryClient.removeQueries({ queryKey: ["auth"] });
            navigate("/", { replace: true });
          } else {
            toast.error(result.message ?? "Failed to accept invitation");
          }
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
        },
      },
    );
  }

  function handleDecline() {
    if (!token) return;
    declineMutation.mutate(
      { token },
      {
        onSuccess: () => {
          toast.success("Invitation declined");
          navigate("/", { replace: true });
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to decline invitation");
        },
      },
    );
  }

  const returnToPath = `/invite?token=${encodeURIComponent(token ?? "")}`;

  // No token
  if (!token) {
    return (
      <PageShell>
        <ErrorCard
          icon={<XCircle className="size-8 text-destructive" />}
          title="Invalid invitation link"
          description="This link is missing the invitation token. Please check the link and try again."
        />
      </PageShell>
    );
  }

  // Loading invitation details
  if (isLoading) {
    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <BrandHeader />
            <Skeleton className="mt-4 h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
          <CardFooter className="justify-center gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  // Invitation not found
  if (isError || !invitation) {
    return (
      <PageShell>
        <ErrorCard
          icon={<XCircle className="size-8 text-destructive" />}
          title="Invitation not found"
          description="This invitation may have been revoked or the link is invalid."
        />
      </PageShell>
    );
  }

  // Expired
  if (invitation.status === "expired") {
    return (
      <PageShell>
        <ErrorCard
          icon={<Clock className="size-8 text-muted-foreground" />}
          title="Invitation expired"
          description="This invitation has expired. Please ask the building admin to send a new one."
        />
      </PageShell>
    );
  }

  // Already accepted/declined/revoked
  if (invitation.status !== "pending") {
    return (
      <PageShell>
        <ErrorCard
          icon={<AlertTriangle className="size-8 text-muted-foreground" />}
          title={`Invitation ${invitation.status}`}
          description={`This invitation has already been ${invitation.status}.`}
        />
      </PageShell>
    );
  }

  // Checking auth status
  if (isLoggedIn === null) {
    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <PageShell>
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <BrandHeader />
            <CardTitle className="mt-4 text-xl">
              You've been invited to join <span className="font-bold">{invitation.organizationName}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InvitationDetailsList invitation={invitation} />
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <p className="text-muted-foreground text-sm">Log in to accept this invitation</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center gap-3">
            <Button asChild>
              <Link to={`/login?returnTo=${encodeURIComponent(returnToPath)}`}>Login</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/register?returnTo=${encodeURIComponent(returnToPath)}`}>Register</Link>
            </Button>
          </CardFooter>
        </Card>
      </PageShell>
    );
  }

  // Logged in — show accept/decline
  const isMutating = acceptMutation.isPending || declineMutation.isPending;

  return (
    <PageShell>
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <BrandHeader />
          <CardTitle className="mt-4 text-xl">
            You've been invited to join <span className="font-bold">{invitation.organizationName}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InvitationDetailsList invitation={invitation} />
        </CardContent>
        <CardFooter className="justify-center gap-3">
          <Button onClick={handleAccept} disabled={isMutating}>
            {acceptMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Accept
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleDecline} disabled={isMutating}>
            {declineMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Declining...
              </>
            ) : (
              "Decline"
            )}
          </Button>
        </CardFooter>
      </Card>
    </PageShell>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-background p-4">{children}</div>;
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2">
      <Command className="size-5" />
      <span className="font-semibold text-lg">{APP_CONFIG.name}</span>
    </div>
  );
}

interface InvitationDetailsListProps {
  invitation: NonNullable<Awaited<ReturnType<typeof getInvitationDetails>>>;
}

function InvitationDetailsList({ invitation }: InvitationDetailsListProps) {
  const formattedExpiry = invitation.expiresAt
    ? new Date(invitation.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-3 text-sm">
      {invitation.role && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Role</span>
          <Badge variant="secondary" className="capitalize">
            {invitation.role}
          </Badge>
        </div>
      )}
      {invitation.inviterEmail && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Invited by</span>
          <span className="flex items-center gap-1.5">
            <Mail className="size-3.5 text-muted-foreground" />
            {invitation.inviterEmail}
          </span>
        </div>
      )}
      {formattedExpiry && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Expires</span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            {formattedExpiry}
          </span>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <BrandHeader />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        {icon}
        <div className="space-y-2">
          <h2 className="font-semibold text-lg">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="outline" asChild>
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
