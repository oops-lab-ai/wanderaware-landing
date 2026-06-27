import { useMutation, useQueryClient } from "@tanstack/react-query";

import * as api from "@/lib/amplify/data-client";

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: api.createCheckoutSession,
  });
}

export function useCreateBillingPortal() {
  return useMutation({
    mutationFn: api.createBillingPortal,
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.changePlan,
    // `await Promise.all` so the mutation isn't "settled" until the visible queries
    // (auth/usage/organization) have refetched. Without this, the toast fires before
    // the page re-renders and the user sees stale plan info until they reload.
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth"] }),
        queryClient.invalidateQueries({ queryKey: ["usage"] }),
        queryClient.invalidateQueries({ queryKey: ["organization"] }),
      ]);
    },
  });
}

export function useCancelDowngrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelDowngrade,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth"] }),
        queryClient.invalidateQueries({ queryKey: ["usage"] }),
        queryClient.invalidateQueries({ queryKey: ["organization"] }),
      ]);
    },
  });
}

export function useEndTrialEarly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.endTrialEarly,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth"] }),
        queryClient.invalidateQueries({ queryKey: ["usage"] }),
      ]);
    },
  });
}

// ── Multi-org mutations ───────────────────────────────────────────────────

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.setupOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.acceptInvitation,
    onSuccess: () => {
      // Auth refetches the new org list; myInvitations refetches so the sidebar
      // badge clears immediately. Both must invalidate or the user sees stale UI.
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["myInvitations"] });
    },
  });
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.declineInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myInvitations"] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeMember,
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orgMembers", variables.organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["devices", variables.organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["usage", variables.organizationId] }),
      ]);
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateMemberRole,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
    },
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.transferOwnership,
    // The role label in the org switcher comes from the `["auth"]` query (session
    // shape). Await both so the switcher label flips from "owner" to "admin"
    // synchronously before the toast fires.
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth"] }),
        queryClient.invalidateQueries({ queryKey: ["orgMembers"] }),
      ]);
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

// Owner soft-deletes the org. The Lambda enforces name confirmation, no-active-Stripe,
// and cascade-releases all device capacity. Invalidate ["auth"] so the deleted org
// disappears from the org switcher; the caller is responsible for clearing the
// active-org pointer + navigating before AuthGuard re-derives the session.
export function useRemoveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
  });
}

// Member self-removal. Owner cannot call this; last-admin can't leave with non-admin
// members remaining. Same invalidation pattern as remove.
export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.leaveOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
    },
  });
}
