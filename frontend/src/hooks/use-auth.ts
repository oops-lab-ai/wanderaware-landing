import { useQuery } from "@tanstack/react-query";
import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";

import { awaitOAuthCallbackIfPresent } from "@/lib/amplify/auth-client";
import { getOrganization, getProfile, listMemberships, listUserOrganizations } from "@/lib/amplify/data-client";
import type { UserOrgItem, UserProfile } from "@/lib/amplify/types";

/**
 * Slow auth payload — fetched once on cold load and cached for 10 minutes.
 *
 * This is intentionally narrow: only the things that DON'T change when the user
 * switches between organizations. The active org id lives separately in
 * lib/active-org-id.ts (module-level pub/sub) so org switching is zero network calls.
 *
 * Anything plan-tier-specific lives in either UserOrgItem (lightweight, included here)
 * or in the heavyweight useOrganization hook keyed by org id (separate query).
 */
export interface AuthData {
  userId: string;
  email: string;
  profile: UserProfile;
  organizations: UserOrgItem[];
}

async function loadOrganizations(): Promise<UserOrgItem[]> {
  // Try the new ListUserOrganizations Lambda first (works for all roles).
  try {
    const { organizations } = await listUserOrganizations();
    if (organizations && organizations.length > 0) {
      return organizations;
    }
  } catch (e) {
    // Lambda not deployed or GraphQL error — fall back to direct model reads (owner-only).
    console.warn("ListUserOrganizations failed, using fallback:", e instanceof Error ? e.message : e);
  }

  // Fallback: Membership.list() + Organization.get() in parallel (works for org owners).
  const memberships = await listMemberships();
  const results = await Promise.allSettled(
    memberships.map(async (m) => {
      const org = await getOrganization(m.organizationId);
      // Defense in depth: the Lambda is the primary filter for soft-deleted orgs,
      // but this fallback path runs when listUserOrganizations errors out, so it
      // needs the same check. Otherwise a deleted org could leak into the org
      // switcher whenever the Lambda fails.
      if (!org || org.deletedAt) return null;
      return {
        organizationId: org.id,
        name: org.name,
        planTier: org.planTier,
        role: m.role,
        membershipId: m.id,
        maxDevices: org.maxDevices ?? 1,
      } as UserOrgItem;
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<UserOrgItem | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is UserOrgItem => v !== null);
}

async function loadAuth(): Promise<AuthData> {
  // Wait for Amplify's OAuth code-for-token exchange to land before asking who the user
  // is. No-op when there are no OAuth params in the URL (email/password sign-in).
  await awaitOAuthCallbackIfPresent();

  // This throws if not authenticated — AuthGuard catches it and redirects to /login.
  const cognitoUser = await getCurrentUser();
  const attrs = await fetchUserAttributes();
  const userId = cognitoUser.userId;
  const email = attrs.email ?? "";

  const organizations = await loadOrganizations();
  // Zero-org state is now valid. AuthGuard reads auth.data.organizations.length
  // and routes the user to /welcome where they can accept a pending invite or
  // create a new workspace. We do NOT throw here — that would render the broken
  // "Something went wrong" data-error page instead of the welcome flow.
  // Profile-missing IS still a real backend bug → throw below.

  const profile = await getProfile(userId);
  if (!profile) throw new Error("Profile not found");

  return {
    userId,
    email,
    profile,
    organizations,
  };
}

function isAuthError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "UserUnAuthenticatedException" ||
    error.name === "NotAuthorizedException" ||
    message.includes("not authenticated") ||
    message.includes("no current user") ||
    message.includes("token")
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function useAuth() {
  return useQuery<AuthData>({
    queryKey: ["auth"],
    queryFn: () => withTimeout(loadAuth(), 30_000, "Timed out loading account session"),
    // 10 min — auth data really doesn't change. Refresh-on-window-focus is already
    // disabled globally. The only mutations that flip auth data (sign-out, profile
    // edit, org rename, accept-invitation, change-plan) explicitly invalidate
    // ["auth"] or call setQueryData(["auth"], updater) to update in place.
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => !isAuthError(error) && failureCount < 2,
    retryDelay: 1000,
  });
}
