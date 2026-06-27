import { useCallback, useMemo } from "react";

import { Link, Navigate, Outlet, useLocation } from "react-router";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { MoleculeLoader } from "@/components/ui/molecule-loader";
import { SessionProvider } from "@/contexts/session-context";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";

export default function AuthGuard() {
  const auth = useAuth();
  const { data: session, isLoading, error } = useSession();
  const queryClient = useQueryClient();
  const location = useLocation();

  const loginRedirect = (() => {
    const path = `${location.pathname}${location.search}`;
    if (path === "/" || path === "") return "/login";
    return `/login?returnTo=${encodeURIComponent(path)}`;
  })();

  const switchOrganization = useCallback(
    (orgId: string) => {
      session?.switchOrganization(orgId);
      queryClient.invalidateQueries({ queryKey: ["usage"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    [queryClient, session],
  );

  const sessionWithSwitch = useMemo(() => {
    if (!session) return null;
    return { ...session, switchOrganization };
  }, [session, switchOrganization]);

  if (isLoading || auth.isLoading) return <MoleculeLoader />;

  const realError = error ?? auth.error;
  if (realError) {
    const msg = realError.message?.toLowerCase() ?? "";
    const isAuthError =
      realError.name === "UserUnAuthenticatedException" ||
      msg.includes("not authenticated") ||
      msg.includes("no current user") ||
      msg.includes("token") ||
      realError.name === "NotAuthorizedException";
    if (isAuthError) return <Navigate to={loginRedirect} replace />;

    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-8">
        <h1 className="font-semibold text-xl">Something went wrong</h1>
        <p className="max-w-md text-center text-muted-foreground text-sm">
          {realError.message || "Failed to load your account data."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["auth"] })}>
            Retry
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Back to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (auth.data && auth.data.organizations.length === 0) return <Navigate to="/welcome" replace />;
  if (!sessionWithSwitch) return <Navigate to={loginRedirect} replace />;

  return (
    <SessionProvider value={sessionWithSwitch}>
      <Outlet />
    </SessionProvider>
  );
}
