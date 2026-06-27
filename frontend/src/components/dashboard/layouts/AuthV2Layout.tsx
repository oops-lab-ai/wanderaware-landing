import { useEffect, useState } from "react";

import { Navigate, Outlet, useSearchParams } from "react-router";

import { getCurrentUser } from "aws-amplify/auth";

import { AuthGlobePanel } from "@/components/dashboard/views/auth/v2/_components/auth-globe-panel";
import { MoleculeLoader } from "@/components/ui/molecule-loader";
import { awaitOAuthCallbackIfPresent } from "@/lib/amplify/auth-client";

export default function Layout() {
  const [authState, setAuthState] = useState<"checking" | "guest" | "authenticated">("checking");
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    let canceled = false;

    async function checkCurrentUser() {
      await awaitOAuthCallbackIfPresent();
      if (canceled) return;

      try {
        await getCurrentUser();
        if (!canceled) setAuthState("authenticated");
      } catch {
        if (!canceled) setAuthState("guest");
      }
    }

    void checkCurrentUser();

    return () => {
      canceled = true;
    };
  }, []);

  if (authState === "checking") return <MoleculeLoader />;
  if (authState === "authenticated") return <Navigate to={returnTo || "/"} replace />;

  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-2 hidden h-full lg:block">
          <AuthGlobePanel />
        </div>
        <div className="relative order-1 flex h-full">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
