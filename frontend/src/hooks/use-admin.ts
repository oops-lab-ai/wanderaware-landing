import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type AdminGrantAction,
  adminCreateCode,
  adminDeleteUser,
  adminDisableUser,
  adminEnableUser,
  adminGetOrg,
  adminGetUser,
  adminGrantOrg,
  adminListCodes,
  adminListGrants,
  adminReleaseOrgDevice,
  adminRemoveOrgMember,
  adminResetUserPassword,
  adminRestoreOrg,
  adminRevokeCode,
  adminSearchOrgs,
  adminSearchUsers,
  adminSignOutUser,
  adminUpdateGrant,
  adminUpdateOrgMemberRole,
  adminUpdateOrgPlan,
} from "@/lib/amplify/data-client";

// ── Grants ──────────────────────────────────────────────────────────────────

export function useAdminGrants() {
  return useQuery({
    queryKey: ["admin", "grants"],
    queryFn: adminListGrants,
    staleTime: 30 * 1000,
  });
}

export function useAdminUpdateGrant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      organizationId: string;
      action: AdminGrantAction;
      extensionDays?: number;
      customExpiresAt?: string;
    }) => adminUpdateGrant(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "grants"] });
      // Invalidate org-detail too in case the admin is on the org page
      queryClient.invalidateQueries({ queryKey: ["admin", "org"] });
    },
  });
}

// ── Codes ───────────────────────────────────────────────────────────────────

export function useAdminCodes() {
  return useQuery({
    queryKey: ["admin", "codes"],
    queryFn: adminListCodes,
    staleTime: 30 * 1000,
  });
}

export function useAdminCreateCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminCreateCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "codes"] });
    },
  });
}

export function useAdminRevokeCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminRevokeCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "codes"] });
    },
  });
}

// ── Users ───────────────────────────────────────────────────────────────────

export function useAdminSearchOrgs(query: string) {
  return useQuery({
    queryKey: ["admin", "orgs", "search", query],
    queryFn: () => adminSearchOrgs(query),
    staleTime: 30 * 1000,
  });
}

export function useAdminGetOrg(organizationId: string | null) {
  return useQuery({
    queryKey: ["admin", "org", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("Organization id is required");
      return adminGetOrg(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
  });
}

function invalidateOrgQueries(queryClient: ReturnType<typeof useQueryClient>, organizationId: string) {
  queryClient.invalidateQueries({ queryKey: ["admin", "org", organizationId] });
  queryClient.invalidateQueries({ queryKey: ["admin", "orgs", "search"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "grants"] });
}

export function useAdminUpdateOrgMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminUpdateOrgMemberRole,
    onSuccess: (_, args) => invalidateOrgQueries(queryClient, args.organizationId),
  });
}

export function useAdminRemoveOrgMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminRemoveOrgMember,
    onSuccess: (_, args) => invalidateOrgQueries(queryClient, args.organizationId),
  });
}

export function useAdminReleaseOrgDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminReleaseOrgDevice,
    onSuccess: (_, args) => invalidateOrgQueries(queryClient, args.organizationId),
  });
}

export function useAdminRestoreOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => adminRestoreOrg(organizationId),
    onSuccess: (_, organizationId) => invalidateOrgQueries(queryClient, organizationId),
  });
}

export function useAdminGrantOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminGrantOrg,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "grants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs", "search"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminUpdateOrgPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminUpdateOrgPlan,
    onSuccess: (_data, variables) => {
      invalidateOrgQueries(queryClient, variables.organizationId);
      queryClient.invalidateQueries({ queryKey: ["admin", "grants"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminSearchUsers(query: string) {
  return useQuery({
    queryKey: ["admin", "users", "search", query],
    queryFn: () => adminSearchUsers(query),
    staleTime: 30 * 1000,
  });
}

export function useAdminGetUser(userId: string | null) {
  return useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: () => {
      if (!userId) throw new Error("User id is required");
      return adminGetUser(userId);
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

// Shared invalidation for the five user-action mutations. After any action,
// refetch the affected user's detail (so status badges flip) and the search
// results (so the list reflects new state).
function invalidateUserQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  queryClient.invalidateQueries({ queryKey: ["admin", "users", userId] });
  queryClient.invalidateQueries({ queryKey: ["admin", "users", "search"] });
}

export function useAdminDisableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminDisableUser(userId),
    onSuccess: (_, userId) => invalidateUserQueries(queryClient, userId),
  });
}

export function useAdminEnableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminEnableUser(userId),
    onSuccess: (_, userId) => invalidateUserQueries(queryClient, userId),
  });
}

export function useAdminSignOutUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminSignOutUser(userId),
    onSuccess: (_, userId) => invalidateUserQueries(queryClient, userId),
  });
}

export function useAdminResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminResetUserPassword(userId),
    onSuccess: (_, userId) => invalidateUserQueries(queryClient, userId),
  });
}

export function useAdminDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminDeleteUser(userId),
    onSuccess: (_, userId) => invalidateUserQueries(queryClient, userId),
  });
}
