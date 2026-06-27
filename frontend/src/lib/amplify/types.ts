import type { Schema } from "@wanderaware/backend/schema";

// Amplify Gen 2 declares custom-type fields as `field?: T | undefined` (optional
// with undefined). Most of our consumers want `field: T` so they can branch on
// null vs. value rather than optional vs. null vs. value. This helper strips
// the optionality + undefined.
type Resolved<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

// ── Schema-owned model types ──────────────────────────────────────────────
export type UserProfile = Schema["Profile"]["type"];
export type Organization = Schema["Organization"]["type"];
export type Membership = Schema["Membership"]["type"];
export type Invitation = Schema["Invitation"]["type"];
export type PromoCode = Schema["PromoCode"]["type"];

export type PlanTier = NonNullable<Organization["planTier"]>;
export type MembershipRole = NonNullable<Membership["role"]>;
export type SubscriptionStatus = NonNullable<Organization["subscriptionStatus"]>;

// ── Schema-owned custom-type element types ────────────────────────────────
// These resolve cleanly at the top level. Whenever a custom op returns
// `a.ref('X').array()`, the inner element is NOT auto-resolved off the op's
// returnType (Amplify leaves it as a RefType wrapper). Pull the element type
// from the customType directly instead.
export type SubscriptionProduct = Resolved<NonNullable<Schema["SubscriptionProduct"]["type"]>>;
export type DeviceItem = Resolved<NonNullable<Schema["DeviceItem"]["type"]>>;
export type UserOrgItem = Resolved<NonNullable<Schema["UserOrgItem"]["type"]>>;
export type OrgMember = Resolved<NonNullable<Schema["OrgMemberItem"]["type"]>>;
export type InvitationRecord = Resolved<NonNullable<Schema["InvitationItem"]["type"]>>;

// ── Schema-owned custom op return types (scalar shapes — these resolve) ───
export type CheckoutSessionResult = NonNullable<Schema["CreateCheckoutSession"]["returnType"]>;
export type BillingPortalResult = NonNullable<Schema["CreateBillingPortal"]["returnType"]>;
export type EndTrialResult = NonNullable<Schema["EndTrialEarly"]["returnType"]>;
export type UsageData = NonNullable<Schema["GetOrgUsage"]["returnType"]>;
export type ChangePlanResult = NonNullable<Schema["ChangePlan"]["returnType"]>;
export type PreviewPlanChangeResult = NonNullable<Schema["PreviewPlanChange"]["returnType"]>;
export type CancelDowngradeResult = NonNullable<Schema["CancelDowngrade"]["returnType"]>;
export type RedeemPromoCodeResult = NonNullable<Schema["RedeemPromoCode"]["returnType"]>;

// ── List-result envelopes (frontend-only, since the inner array is RefType) ─
export interface ListOrgDevicesResult {
  devices: DeviceItem[];
  totalDevicesUsed: number;
  maxDevices: number;
}

// ── Frontend-only session shapes ───────────────────────────────────────────
// These are derived from multiple calls and include client runtime helpers, so
// they intentionally do not mirror a single backend schema return type. The
// session.organization is a *lightweight* projection from UserOrgItem — any
// page that needs the full Stripe state must call useOrganization(id).

/** Lightweight org projection used in session — does NOT include lazy loaders
 * (memberships) or audit fields (createdAt/updatedAt). Pages that need billing
 * state (cancelAtPeriodEnd, currentPeriodEnd, scheduledDowngrade*, etc.) must
 * call useOrganization(id). */
export interface SessionOrganization {
  id: string;
  name: string;
  ownerId: string;
  planTier: Organization["planTier"];
  maxDevices: number;
  stripeCustomerId: string | null;
}

export interface SessionMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: MembershipRole | null;
}

/** Raw session returned by useSession query (no runtime functions). */
export interface RawSessionData {
  userId: string;
  email: string;
  profile: UserProfile;
  organization: SessionOrganization;
  membership: SessionMembership;
  organizations: UserOrgItem[];
}

/** Full session data provided via SessionContext (includes runtime helpers). */
export interface SessionData extends RawSessionData {
  switchOrganization: (orgId: string) => void;
}
