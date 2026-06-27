import { useQuery } from "@tanstack/react-query";

import { fetchInvitations, listMyInvitations } from "@/lib/amplify/data-client";

export function useInvitations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["invitations", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Organization id is required");
      return fetchInvitations(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });
}

/**
 * Pending invitations addressed to the current user across ALL orgs (for the
 * "Invitations to You" panel + sidebar badge). Refetches on window focus so a
 * user who accepts an invite in another tab sees the badge clear immediately.
 *
 * Cache key intentionally has NO orgId — these invites are user-scoped, not
 * org-scoped, and they're invalidated by accept/decline mutations + cleared on
 * sign-out via use-mutations.ts.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: ["myInvitations"],
    queryFn: listMyInvitations,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
