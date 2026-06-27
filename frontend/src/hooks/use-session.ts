import { useCallback, useEffect, useMemo } from "react";

import { useActiveOrgId } from "@/hooks/use-active-org-id";
import { type AuthData, useAuth } from "@/hooks/use-auth";
import { setActiveUser } from "@/lib/active-org-id";
import type { RawSessionData, SessionMembership, SessionOrganization, UserOrgItem } from "@/lib/amplify/types";

/**
 * Derived selector — composes useAuth (slow query, key ["auth"]) + useActiveOrgId
 * (module-level pub/sub) into the same SessionData shape consumers expect.
 *
 * NO React Query under this hook. Org switching is a single setState in the pub/sub
 * which fires every useSyncExternalStore subscriber synchronously. The auth query
 * never re-runs unless explicitly invalidated.
 */

function requireString(value: string | null | undefined, label: string): string {
  if (!value) throw new Error(`Missing ${label} in organization session data`);
  return value;
}

function deriveOrganization(item: UserOrgItem): SessionOrganization {
  return {
    id: requireString(item.organizationId, "organization id"),
    name: requireString(item.name, "organization name"),
    ownerId: "",
    planTier: item.planTier as SessionOrganization["planTier"],
    maxDevices: item.maxDevices ?? 1,
    stripeCustomerId: null,
    // cancelAtPeriodEnd / currentPeriodEnd / scheduledDowngrade* are NOT included.
    // They live in the heavyweight useOrganization query (keyed by org id).
    // Pages that need them must call useOrganization(org.id) directly.
  };
}

function deriveMembership(item: UserOrgItem, userId: string): SessionMembership {
  return {
    id: requireString(item.membershipId, "membership id"),
    userId,
    organizationId: requireString(item.organizationId, "organization id"),
    role: item.role as SessionMembership["role"],
  };
}

function deriveSession(auth: AuthData, activeOrgId: string | null): RawSessionData | null {
  if (auth.organizations.length === 0) return null;

  const activeOrg = auth.organizations.find((o) => o.organizationId === activeOrgId) ?? auth.organizations[0];
  if (!activeOrg) return null;

  return {
    userId: auth.userId,
    email: auth.email,
    profile: auth.profile,
    organization: deriveOrganization(activeOrg),
    membership: deriveMembership(activeOrg, auth.userId),
    organizations: auth.organizations,
  };
}

export function useSession() {
  const auth = useAuth();
  const [activeOrgId, setActiveOrgIdInternal] = useActiveOrgId();

  // Push the current user id into the per-user pub/sub. This loads their stored
  // org pick (if any) on first auth resolve, and clears it on sign-out so the
  // next user's session doesn't inherit the previous user's last-active org on
  // a shared care center web.
  useEffect(() => {
    setActiveUser(auth.data?.userId ?? null);
  }, [auth.data?.userId]);

  const sessionData = useMemo(
    () => (auth.data ? deriveSession(auth.data, activeOrgId) : null),
    [auth.data, activeOrgId],
  );

  const switchOrganization = useCallback(
    (orgId: string) => {
      setActiveOrgIdInternal(orgId);
      // The pub/sub fires synchronously; every useSyncExternalStore subscriber
      // re-renders in the same React batch. Per-page org-scoped queries get
      // invalidated by the AuthGuard wrapper that calls this — see AuthGuard.tsx.
    },
    [setActiveOrgIdInternal],
  );

  return {
    data: sessionData ? { ...sessionData, switchOrganization } : null,
    isLoading: auth.isLoading,
    error: auth.error,
  };
}
