// Side-effect import — auth-client configures Amplify at module load. Must be the
// first non-type import here so generateClient() below sees a configured Amplify
// instance regardless of which module evaluates this file first.
import "./auth-client";

import { generateClient } from "aws-amplify/data";

import type {
  BillingPortalResult,
  CheckoutSessionResult,
  EndTrialResult,
  InvitationRecord,
  ListOrgDevicesResult,
  Membership,
  Organization,
  OrgMember,
  SubscriptionProduct,
  UsageData,
  UserOrgItem,
  UserProfile,
} from "./types";

// Untyped client — we define our own types locally to avoid cross-package schema import.
// All custom queries/mutations go through client.queries.* or client.mutations.*
// Model CRUD goes through client.models.*
//
// Convention for mutation wrappers: destructure `{ data, errors }` and `throw` on
// `errors[].message`. AppSync returns HTTP 200 with `errors:[{message}]` for Lambda
// failures, so without the throw the call site sees a silent null result and falls
// back to generic "Failed to <do thing>" copy instead of the backend's actionable
// reason (e.g. "Please cancel your subscription first…"). useMutation's `onError`
// + page-level try/catch then surface the message via `e.message`.
const client = generateClient();

type GraphQLError = { message?: string | null };
type GraphQLResult<T = unknown> = { data?: T | null; errors?: GraphQLError[] };
type GraphQLOperation = (args?: unknown, options?: unknown) => Promise<GraphQLResult>;

type DataClientFacade = {
  models: {
    Profile: {
      get: (args: { id: string }) => Promise<GraphQLResult>;
      update: (args: { id: string; newsLetter?: boolean }) => Promise<GraphQLResult>;
    };
    Organization: {
      get: (args: { id: string }) => Promise<GraphQLResult>;
      update: (args: { id: string; name?: string }) => Promise<GraphQLResult>;
    };
    Membership: {
      list: () => Promise<GraphQLResult>;
    };
  };
  queries: Record<string, GraphQLOperation>;
  mutations: Record<string, GraphQLOperation>;
};

const dataClient = client as unknown as DataClientFacade;

function throwGraphQLErrors(errors: Array<{ message?: string | null }> | undefined, fallback: string): void {
  if (errors?.length) throw new Error(errors[0].message ?? fallback);
}

// ── Model CRUD (owner-scoped by Amplify auth rules) ────────────────────────

export async function getProfile(id: string): Promise<UserProfile | null> {
  const { data } = await dataClient.models.Profile.get({ id });
  return data as UserProfile | null;
}

export async function updateProfile(id: string, fields: { newsLetter?: boolean }): Promise<UserProfile | null> {
  const { data } = await dataClient.models.Profile.update({ id, ...fields });
  return data as UserProfile | null;
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data } = await dataClient.models.Organization.get({ id });
  return data as Organization | null;
}

export async function updateOrganization(id: string, fields: { name?: string }): Promise<Organization | null> {
  const { data } = await dataClient.models.Organization.update({ id, ...fields });
  return data as Organization | null;
}

export async function listMemberships(): Promise<Membership[]> {
  const { data } = await dataClient.models.Membership.list();
  return (data ?? []) as Membership[];
}

// ── Custom queries ─────────────────────────────────────────────────────────

export async function getProducts(): Promise<{ subscriptionProducts: SubscriptionProduct[] }> {
  const { data } = await dataClient.queries.GetProducts();
  return (data ?? { subscriptionProducts: [] }) as { subscriptionProducts: SubscriptionProduct[] };
}

// Real org usage backed by DeviceActivation rows. Replaces the dead getPlanUsage
// which counted Plan records (always 0 after the PKCE migration).
export async function getUsage(organizationId: string): Promise<UsageData> {
  const { data } = await dataClient.queries.GetOrgUsage({ organizationId });
  return (data ?? { planTier: null, seatsUsed: 0, maxDevices: 0, maxDevicesPerUser: null }) as UsageData;
}

export async function listOrgDevices(organizationId: string): Promise<ListOrgDevicesResult> {
  const { data } = await dataClient.queries.ListOrgDevices({ organizationId });
  return (data ?? { devices: [], totalDevicesUsed: 0, maxDevices: 0 }) as ListOrgDevicesResult;
}

// Revoke a device from the dashboard's Devices page. Calls the same Lambda the
// web sign-out flow uses. Pass `targetUserId` to revoke another user's device
// (only allowed if caller is an org owner/admin — enforced server-side).
export async function releaseDevice(
  deviceId: string,
  targetUserId?: string,
): Promise<{ success: boolean | null; message: string | null }> {
  const args: { deviceId: string; targetUserId?: string } = { deviceId };
  if (targetUserId) args.targetUserId = targetUserId;
  const { data, errors } = await dataClient.mutations.ReleaseDevice(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to release device");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

// Redeem a promo code, creating a new "plan grant" org for the caller. The caller
// must be authenticated; the redeem page handles the "not signed in → register first"
// redirect on the frontend before calling this.
export interface RedeemPromoCodeResult {
  success: boolean | null;
  organizationId: string | null;
  organizationName: string | null;
  grantExpiresAt: string | null;
  message: string | null;
}
export async function redeemPromoCode(code: string): Promise<RedeemPromoCodeResult> {
  const { data, errors } = await dataClient.mutations.RedeemPromoCode({ code });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to redeem code");
  return (data ?? {
    success: false,
    organizationId: null,
    organizationName: null,
    grantExpiresAt: null,
    message: "No response from server",
  }) as RedeemPromoCodeResult;
}

// ── Admin operations (Cognito 'admins' group only) ─────────────────────────
// These all hit Lambdas gated by `allow.groups(['admins'])`. Non-admin callers
// get a GraphQL auth error from AppSync. Frontend gating via useIsAdmin is purely
// cosmetic — schema gate is the real boundary.

export interface AdminGrantItem {
  organizationId: string;
  organizationName: string;
  ownerEmail: string | null;
  planTier: string | null;
  planSource: string | null;
  maxDevices: number | null;
  createdAt: string | null;
  grantExpiresAt: string | null;
  status: "active" | "expiring-soon" | "expired" | "permanent";
  sourceCode: string | null;
}
export interface AdminListGrantsResult {
  grants: AdminGrantItem[];
  totalActive: number;
  totalExpiringSoon: number;
  totalEverGranted: number;
}
export async function adminListGrants(): Promise<AdminListGrantsResult> {
  const { data, errors } = await dataClient.queries.AdminListGrants();
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to load grants");
  return (data ?? { grants: [], totalActive: 0, totalExpiringSoon: 0, totalEverGranted: 0 }) as AdminListGrantsResult;
}

export type AdminGrantAction = "revoke" | "extend" | "permanent" | "set-custom";
export async function adminUpdateGrant(args: {
  organizationId: string;
  action: AdminGrantAction;
  extensionDays?: number;
  customExpiresAt?: string;
}): Promise<{ success: boolean | null; grantExpiresAt: string | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.AdminUpdateGrant(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to update grant");
  return (data ?? { success: false, grantExpiresAt: null, message: null }) as {
    success: boolean | null;
    grantExpiresAt: string | null;
    message: string | null;
  };
}

export interface AdminCodeItem {
  code: string;
  label: string | null;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: string | null;
  expiresInDays: number | null;
  planTier: string | null;
  maxDevices: number | null;
  createdAt: string | null;
  status: "active" | "inactive";
}
export async function adminListCodes(): Promise<{ codes: AdminCodeItem[] }> {
  const { data, errors } = await dataClient.queries.AdminListCodes();
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to load codes");
  return (data ?? { codes: [] }) as { codes: AdminCodeItem[] };
}

export async function adminCreateCode(args: {
  label?: string;
  maxRedemptions?: number;
  expiresInDays?: number;
  codeExpiresInDays?: number;
  planTier?: string;
  maxDevices?: number;
}): Promise<{ success: boolean | null; code: string | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.AdminCreateCode(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to create code");
  return (data ?? { success: false, code: null, message: null }) as {
    success: boolean | null;
    code: string | null;
    message: string | null;
  };
}

export async function adminRevokeCode(code: string): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.AdminRevokeCode({ code });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to revoke code");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

// ── Admin user management ──────────────────────────────────────────────────

export interface AdminUserSearchItem {
  userId: string;
  email: string | null;
  createdAt: string | null;
  orgCount: number;
  enabled: boolean | null;
  userStatus: string | null;
  lastModifiedAt: string | null;
}

export interface AdminUserDetail {
  userId: string;
  email: string | null;
  createdAt: string | null;
  newsLetter: boolean | null;
  enabled: boolean | null;
  userStatus: string | null;
  lastModifiedAt: string | null;
}

export interface AdminUserOrgItem {
  membershipId: string | null;
  role: string | null;
  organizationId: string | null;
  organizationName: string | null;
  planTier: string | null;
  planSource: string | null;
  grantExpiresAt: string | null;
  deletedAt: string | null;
}

export interface AdminUserRedemption {
  code: string | null;
  organizationId: string | null;
  redeemedAt: string | null;
}

export interface AdminGetUserResult {
  user: AdminUserDetail | null;
  organizations: AdminUserOrgItem[];
  redemptions: AdminUserRedemption[];
}

export async function adminSearchUsers(query: string): Promise<{ users: AdminUserSearchItem[] }> {
  const { data, errors } = await dataClient.queries.AdminSearchUsers({ query });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to search users");
  return (data ?? { users: [] }) as { users: AdminUserSearchItem[] };
}

export async function adminGetUser(userId: string): Promise<AdminGetUserResult> {
  const { data, errors } = await dataClient.queries.AdminGetUser({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to load user");
  return (data ?? { user: null, organizations: [], redemptions: [] }) as AdminGetUserResult;
}

type AdminUserActionResult = { success: boolean | null; message: string | null };
const emptyActionResult: AdminUserActionResult = { success: false, message: null };

export interface AdminOrgSearchItem {
  organizationId: string;
  name: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  planTier: string | null;
  planSource: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  maxDevices: number | null;
  seatsUsed: number | null;
  deviceCount: number | null;
  grantExpiresAt: string | null;
  memberCount: number | null;
  deletedAt: string | null;
}

export interface AdminOrgMember {
  membershipId: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;
}

export interface AdminOrgDevice {
  userId: string | null;
  deviceId: string | null;
  deviceName: string | null;
  activatedAt: string | null;
  lastValidatedAt: string | null;
  organizationId: string | null;
}

export interface AdminOrgDetail {
  id: string;
  name: string | null;
  ownerId: string | null;
  stripeCustomerId: string | null;
  planTier: string | null;
  planSource: string | null;
  maxDevices: number | null;
  seatsUsed: number | null;
  deviceCount: number | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodEnd: string | null;
  scheduledDowngradeTier: string | null;
  scheduledDowngradeDate: string | null;
  grantExpiresAt: string | null;
  deletedAt: string | null;
  createdAt: string | null;
}

export interface AdminPlanAuditItem {
  id: string | null;
  organizationId: string | null;
  actorUserId: string | null;
  action: string | null;
  oldPlanTier: string | null;
  newPlanTier: string | null;
  oldPlanSource: string | null;
  newPlanSource: string | null;
  oldMaxSeats: number | null;
  newMaxSeats: number | null;
  oldGrantExpiresAt: string | null;
  newGrantExpiresAt: string | null;
  reason: string | null;
  createdAt: string | null;
}

export interface AdminGetOrgResult {
  organization: AdminOrgDetail | null;
  members: AdminOrgMember[];
  devices: AdminOrgDevice[];
  auditLog: AdminPlanAuditItem[];
}

export async function adminSearchOrgs(query: string): Promise<{ organizations: AdminOrgSearchItem[] }> {
  const { data, errors } = await dataClient.queries.AdminSearchOrgs({ query });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to search organizations");
  return (data ?? { organizations: [] }) as { organizations: AdminOrgSearchItem[] };
}

export async function adminGetOrg(organizationId: string): Promise<AdminGetOrgResult> {
  const { data, errors } = await dataClient.queries.AdminGetOrg({ organizationId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to load organization");
  return (data ?? { organization: null, members: [], devices: [], auditLog: [] }) as AdminGetOrgResult;
}

export async function adminGrantOrg(args: {
  targetUserId: string;
  expiresInDays?: number;
  planTier?: string;
  maxDevices?: number;
}): Promise<{ success: boolean | null; organizationId: string | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.AdminGrantOrg(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to grant plan grant");
  return (data ?? { success: false, organizationId: null, message: null }) as {
    success: boolean | null;
    organizationId: string | null;
    message: string | null;
  };
}

export async function adminUpdateOrgPlan(args: {
  organizationId: string;
  planTier: string;
  planSource?: string;
  maxDevices?: number;
  grantExpiresAt?: string | null;
  reason?: string;
}): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminUpdateOrgPlan(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to update organization plan");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminUpdateOrgMemberRole(args: {
  organizationId: string;
  membershipId: string;
  role: string;
}): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminUpdateOrgMemberRole(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to update member role");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminRemoveOrgMember(args: {
  organizationId: string;
  membershipId: string;
}): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminRemoveOrgMember(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to remove member");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminReleaseOrgDevice(args: {
  organizationId: string;
  userId: string;
  deviceId: string;
}): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminReleaseOrgDevice(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to release device");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminRestoreOrg(organizationId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminRestoreOrg({ organizationId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to restore organization");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminDisableUser(userId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminDisableUser({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to disable user");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminEnableUser(userId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminEnableUser({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to enable user");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminSignOutUser(userId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminSignOutUser({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to sign out user");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminResetUserPassword(userId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminResetUserPassword({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to reset password");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function adminDeleteUser(userId: string): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.AdminDeleteUser({ userId });
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to delete user");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

// ── Connected Accounts (federated identity management) ─────────────────────

export async function getAuthMethods(): Promise<{ linkedProviders: string[] }> {
  const { data, errors } = await dataClient.queries.GetAuthMethods();
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to load auth methods");
  return (data ?? { linkedProviders: [] }) as { linkedProviders: string[] };
}

export async function disconnectProvider(args: {
  providerName: string;
  newPassword: string;
}): Promise<AdminUserActionResult> {
  const { data, errors } = await dataClient.mutations.DisconnectProvider(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to disconnect provider");
  return (data ?? emptyActionResult) as AdminUserActionResult;
}

export async function createCheckoutSession(args: {
  productId: string;
  priceId: string;
  userId: string;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
  includeTrial?: boolean;
}): Promise<CheckoutSessionResult> {
  const { data, errors } = await dataClient.queries.CreateCheckoutSession(args);
  throwGraphQLErrors(errors, "Failed to create checkout session");
  return (data ?? { sessionId: null, url: null }) as CheckoutSessionResult;
}

export async function createBillingPortal(args: {
  userId: string;
  organizationId: string;
  returnUrl: string;
}): Promise<BillingPortalResult> {
  const { data, errors } = await dataClient.queries.CreateBillingPortal(args);
  throwGraphQLErrors(errors, "Failed to open billing portal");
  return (data ?? { url: null }) as BillingPortalResult;
}

export async function endTrialEarly(args: { userId: string; organizationId: string }): Promise<EndTrialResult> {
  const { data, errors } = await dataClient.queries.EndTrialEarly(args);
  throwGraphQLErrors(errors, "Failed to end trial early");
  return (data ?? { success: false, subscriptionId: null, newStatus: null, message: null }) as EndTrialResult;
}

// ── Multi-org queries ─────────────────────────────────────────────────────

export async function listUserOrganizations(): Promise<{ organizations: UserOrgItem[] }> {
  const { data } = await dataClient.queries.ListUserOrganizations();
  return (data ?? { organizations: [] }) as { organizations: UserOrgItem[] };
}

export async function listOrgMembers(organizationId: string): Promise<{ members: OrgMember[] }> {
  const { data } = await dataClient.queries.ListOrgMembers({ organizationId });
  return (data ?? { members: [] }) as { members: OrgMember[] };
}

export async function getInvitationDetails(token: string): Promise<InvitationRecord | null> {
  // Try default (userPool) auth first, fall back to identityPool for guest access
  try {
    const { data } = await dataClient.queries.GetInvitationDetails({ token });
    return (data ?? null) as InvitationRecord | null;
  } catch (e) {
    // Auth error (not signed in) — retry with identityPool (guest) auth mode
    const isAuthError =
      e instanceof Error && (e.name === "NoValidAuthTokens" || e.message.includes("not authenticated"));
    if (!isAuthError) throw e; // Re-throw non-auth errors
    const { data } = await dataClient.queries.GetInvitationDetails({ token }, { authMode: "identityPool" });
    return (data ?? null) as InvitationRecord | null;
  }
}

export async function fetchInvitations(organizationId: string): Promise<{ invitations: InvitationRecord[] }> {
  const { data } = await dataClient.queries.FetchInvitations({ organizationId });
  return (data ?? { invitations: [] }) as { invitations: InvitationRecord[] };
}

// Returns the caller's pending non-expired invitations across ALL orgs. Used by
// the Team page's "Invitations to You" panel + sidebar pending-count badge so
// users who sign up cold (no email link) can still discover invites waiting on
// their email. The Lambda reads the email from Cognito server-side — never trust
// a client-supplied email here.
export async function listMyInvitations(): Promise<{ invitations: InvitationRecord[] }> {
  const { data } = await dataClient.queries.ListMyInvitations();
  return (data ?? { invitations: [] }) as { invitations: InvitationRecord[] };
}

// ── Multi-org mutations ───────────────────────────────────────────────────

export async function setupOrganization(args: {
  name: string;
}): Promise<{ organizationId: string | null; membershipId: string | null }> {
  const { data, errors } = await dataClient.mutations.SetupOrganization(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to create organization");
  return (data ?? { organizationId: null, membershipId: null }) as {
    organizationId: string | null;
    membershipId: string | null;
  };
}

export async function inviteMember(args: {
  organizationId: string;
  email: string;
  role: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.InviteMember(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to send invitation");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function acceptInvitation(args: {
  token: string;
}): Promise<{ success: boolean | null; organizationId: string | null; role: string | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.AcceptInvitation(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to accept invitation");
  return (data ?? { success: false, organizationId: null, role: null, message: null }) as {
    success: boolean | null;
    organizationId: string | null;
    role: string | null;
    message: string | null;
  };
}

export async function declineInvitation(args: {
  token: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.DeclineInvitation(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to decline invitation");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function removeMember(args: {
  organizationId: string;
  membershipId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.RemoveMember(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to remove member");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function updateMemberRole(args: {
  organizationId: string;
  membershipId: string;
  role: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.UpdateMemberRole(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to update role");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function transferOwnership(args: {
  organizationId: string;
  newOwnerMembershipId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.TransferOwnership(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to transfer ownership");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function revokeInvitation(args: {
  token: string;
  organizationId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.RevokeInvitation(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to revoke invitation");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function removeOrganization(args: {
  organizationId: string;
  confirmName: string;
}): Promise<{ success: boolean | null; message: string | null; deletedAt: string | null; expiresAt: string | null }> {
  const { data, errors } = await dataClient.mutations.RemoveOrganization(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to delete organization");
  return (data ?? { success: false, message: null, deletedAt: null, expiresAt: null }) as {
    success: boolean | null;
    message: string | null;
    deletedAt: string | null;
    expiresAt: string | null;
  };
}

export async function restoreOrganization(args: {
  organizationId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.RestoreOrganization(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to restore organization");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

// Member self-removal. Owner cannot leave (must transfer first); cascade-releases
// the leaving user's device capacity in this org. See ORG_SYSTEM.md for the rules.
export async function leaveOrganization(args: {
  organizationId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.LeaveOrganization(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Failed to leave organization");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}

export async function changePlan(args: {
  organizationId: string;
  newPriceId: string;
}): Promise<{ success: boolean | null; message: string | null; effectiveDate: string | null; newTier: string | null }> {
  const { data, errors } = await dataClient.mutations.ChangePlan(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Plan change failed");
  return (data ?? { success: false, message: null, effectiveDate: null, newTier: null }) as {
    success: boolean | null;
    message: string | null;
    effectiveDate: string | null;
    newTier: string | null;
  };
}

type PreviewPlanChangeData = {
  direction: string | null;
  prorationAmount: number | null;
  creditAmount: number | null;
  chargeAmount: number | null;
  newMonthlyAmount: number | null;
  currentMonthlyAmount: number | null;
  effectiveDate: string | null;
  periodEnd: string | null;
  // Downgrade-only — non-null/true when the org has more active device device capacity than the
  // target tier supports. The dashboard renders a different dialog when blocked=true and
  // disables the Confirm button.
  blocked: boolean | null;
  blockReason: string | null;
  seatsUsed: number | null;
  newTierMaxSeats: number | null;
};

const emptyPreviewPlanChange: PreviewPlanChangeData = {
  direction: null,
  prorationAmount: null,
  creditAmount: null,
  chargeAmount: null,
  newMonthlyAmount: null,
  currentMonthlyAmount: null,
  effectiveDate: null,
  periodEnd: null,
  blocked: null,
  blockReason: null,
  seatsUsed: null,
  newTierMaxSeats: null,
};

export async function previewPlanChange(args: {
  organizationId: string;
  newPriceId: string;
}): Promise<PreviewPlanChangeData> {
  const { data, errors } = await dataClient.queries.PreviewPlanChange(args);
  throwGraphQLErrors(errors, "Plan preview failed");
  return (data ?? emptyPreviewPlanChange) as PreviewPlanChangeData;
}

export async function cancelDowngrade(args: {
  organizationId: string;
}): Promise<{ success: boolean | null; message: string | null }> {
  const { data, errors } = await dataClient.mutations.CancelDowngrade(args);
  if (errors?.length) throw new Error(errors[0].message ?? "Cancel downgrade failed");
  return (data ?? { success: false, message: null }) as { success: boolean | null; message: string | null };
}
