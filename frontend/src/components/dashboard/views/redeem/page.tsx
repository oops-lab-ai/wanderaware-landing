import { useEffect, useState } from "react";

import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "aws-amplify/auth";
import { CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setActiveOrgId, setActiveUser } from "@/lib/active-org-id";
import { redeemPromoCode } from "@/lib/amplify/data-client";

/**
 * Promo code redemption page.
 *
 * Flow:
 *   1. Read `code` from URL params. If missing, show an error.
 *   2. Check auth status. If not signed in, redirect to /register?returnTo=/redeem?code=...
 *   3. Call RedeemPromoCode Lambda. On success, switch active org to the new org id
 *      and redirect to /dashboard. On failure, show the error message.
 *
 * The 'free' tier is hidden everywhere else — this page is the only public
 * surface that grants it. The actual word "free" never appears in user copy;
 * it's labeled "Care Center plan" or "Granted access".
 */
export default function RedeemPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const code = searchParams.get("code");

  const [authState, setAuthState] = useState<"checking" | "guest" | "authenticated">("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [redemptionState, setRedemptionState] = useState<"idle" | "redeeming" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setAuthState("authenticated");
        setUserId(u.userId);
      })
      .catch(() => setAuthState("guest"));
  }, []);

  // Once authenticated, redeem the code (only fires once)
  useEffect(() => {
    if (authState !== "authenticated" || !code || redemptionState !== "idle") return;
    setRedemptionState("redeeming");
    redeemPromoCode(code)
      .then((result) => {
        if (result.success && result.organizationId) {
          setOrgName(result.organizationName ?? null);
          // This page lives outside AuthGuard, so useSession never runs its
          // setActiveUser effect. Wire it manually so setActiveOrgId can persist.
          if (userId) setActiveUser(userId);
          setActiveOrgId(result.organizationId);
          // Wipe auth cache so AuthGuard enters isLoading=true on navigation
          // and flashes MoleculeLoader cleanly instead of rendering the
          // dashboard with stale (pre-redemption) data while the background
          // refetch races with the post-redirect render.
          queryClient.removeQueries({ queryKey: ["auth"] });
          setRedemptionState("success");
          // Auto-redirect to dashboard after a brief success display
          setTimeout(() => {
            navigate("/", { replace: true });
            toast.success(`Welcome to ${result.organizationName ?? "your care center workspace"}!`);
          }, 1500);
        } else {
          setErrorMessage(result.message ?? "Could not redeem code.");
          setRedemptionState("error");
        }
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Could not redeem code.");
        setRedemptionState("error");
      });
  }, [authState, code, redemptionState, navigate, queryClient, userId]);

  // No code at all → just bounce to home
  if (!code) {
    return <Navigate to="/" replace />;
  }

  // Not signed in → bounce to register, with returnTo pointing back here
  if (authState === "guest") {
    const returnTo = encodeURIComponent(`/redeem?code=${encodeURIComponent(code)}`);
    return <Navigate to={`/register?returnTo=${returnTo}`} replace />;
  }

  // Single page rendering all states
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FlaskConical className="size-6" aria-hidden />
          </div>
          <CardTitle className="text-xl">
            {authState === "checking" && "Checking your sign-in..."}
            {redemptionState === "redeeming" && "Activating your care center workspace..."}
            {redemptionState === "success" && "You're in!"}
            {redemptionState === "error" && "Couldn't redeem code"}
            {redemptionState === "idle" && authState === "authenticated" && "Redeem code"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm">
          {(authState === "checking" || redemptionState === "redeeming") && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Just a moment...</span>
            </div>
          )}

          {redemptionState === "success" && (
            <>
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-500">
                <CheckCircle2 className="size-4" />
                <span>{orgName ?? "Your care center workspace"} is ready</span>
              </div>
              <p className="text-muted-foreground">Redirecting to your dashboard...</p>
            </>
          )}

          {redemptionState === "error" && (
            <>
              <div className="flex items-center justify-center gap-2 text-destructive">
                <XCircle className="size-4" />
                <span>{errorMessage ?? "Something went wrong."}</span>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/">Go to dashboard</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
