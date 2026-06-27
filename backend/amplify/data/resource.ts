// NOTE: Amplify logs "Be careful when using @auth directives on a field in a root type"
// during build. This applies to every custom query/mutation defined below (they are all
// fields on the Query/Mutation root type). We only use static auth — allow.groups(),
// allow.authenticated(), allow.guest() — which the warning itself says "performs as
// expected". No runtime impact; the warning is unavoidable for a custom-op-heavy schema.

import { a, defineData } from '@aws-amplify/backend';
import type { ClientSchema } from '@aws-amplify/backend';
import { createCheckoutSession } from '../functions/stripe-functions/createCheckoutSession/resource';
import { createBillingPortal } from '../functions/stripe-functions/createBillingPortal/resource';
import { endTrialEarly } from '../functions/stripe-functions/endTrialEarly/resource';
import { postConfirmation } from '../functions/postConfirmation/resource';
import { postAuthentication } from '../functions/postAuthentication/resource';
import { paymentProcessor } from '../functions/stripe-functions/paymentProcessor/resource';
import { getProducts } from '../functions/stripe-functions/getProducts/resource';
import { sendEmail } from '../functions/sendEmail/resource';
import { sendContactForm } from '../functions/sendContactForm/resource';
import { handleSesNotification } from '../functions/handleSesNotification/resource';
import { listUserOrganizations } from '../functions/listUserOrganizations/resource';
import { setupOrganization } from '../functions/setupOrganization/resource';
import { listOrgMembers } from '../functions/listOrgMembers/resource';
import { inviteMember } from '../functions/inviteMember/resource';
import { getInvitationDetails } from '../functions/getInvitationDetails/resource';
import { acceptInvitation } from '../functions/acceptInvitation/resource';
import { declineInvitation } from '../functions/declineInvitation/resource';
import { removeMember } from '../functions/removeMember/resource';
import { updateMemberRole } from '../functions/updateMemberRole/resource';
import { transferOwnership } from '../functions/transferOwnership/resource';
import { fetchInvitations } from '../functions/fetchInvitations/resource';
import { listMyInvitations } from '../functions/listMyInvitations/resource';
import { revokeInvitation } from '../functions/revokeInvitation/resource';
import { removeOrganization } from '../functions/removeOrganization/resource';
import { restoreOrganization } from '../functions/restoreOrganization/resource';
import { leaveOrganization } from '../functions/leaveOrganization/resource';
import { changePlan } from '../functions/changePlan/resource';
import { previewPlanChange } from '../functions/previewPlanChange/resource';
import { cancelDowngrade } from '../functions/cancelDowngrade/resource';
import { claimDeviceCapacity } from '../functions/claimDeviceCapacity/resource';
import { validateDeviceCapacity } from '../functions/validateDeviceCapacity/resource';
import { releaseDevice } from '../functions/releaseDevice/resource';
import { listOrgDevices } from '../functions/listOrgDevices/resource';
import { getOrgUsage } from '../functions/getOrgUsage/resource';
import { redeemPromoCode } from '../functions/redeemPromoCode/resource';
import { adminListGrants } from '../functions/adminListGrants/resource';
import { adminUpdateGrant } from '../functions/adminUpdateGrant/resource';
import { adminGrantOrg } from '../functions/adminGrantOrg/resource';
import { adminUpdateOrgPlan } from '../functions/adminUpdateOrgPlan/resource';
import { adminListCodes } from '../functions/adminListCodes/resource';
import { adminCreateCode } from '../functions/adminCreateCode/resource';
import { adminRevokeCode } from '../functions/adminRevokeCode/resource';
import { adminSearchUsers } from '../functions/adminSearchUsers/resource';
import { adminGetUser } from '../functions/adminGetUser/resource';
import { adminSearchOrgs } from '../functions/adminSearchOrgs/resource';
import { adminGetOrg } from '../functions/adminGetOrg/resource';
import { adminUpdateOrgMemberRole } from '../functions/adminUpdateOrgMemberRole/resource';
import { adminRemoveOrgMember } from '../functions/adminRemoveOrgMember/resource';
import { adminReleaseOrgDevice } from '../functions/adminReleaseOrgDevice/resource';
import { adminRestoreOrg } from '../functions/adminRestoreOrg/resource';
import { adminDisableUser } from '../functions/adminDisableUser/resource';
import { adminEnableUser } from '../functions/adminEnableUser/resource';
import { adminSignOutUser } from '../functions/adminSignOutUser/resource';
import { adminResetUserPassword } from '../functions/adminResetUserPassword/resource';
import { adminDeleteUser } from '../functions/adminDeleteUser/resource';
import { getAuthMethods } from '../functions/getAuthMethods/resource';
import { disconnectProvider } from '../functions/disconnectProvider/resource';

const schema = a
    .schema({
        SubscriptionProduct: a.customType({
            id: a.string(),
            name: a.string(),
            description: a.string(),
            price: a.float(),
            priceId: a.string(),
            type: a.string(),
            planId: a.string(),
            tier: a.string(),
            marketingFeatures: a.string().array(),
            interval: a.string(),
            intervalCount: a.integer(),
            isRecommended: a.boolean(),
        }),

        GetProducts: a
            .query()
            .returns(
                a.customType({
                    subscriptionProducts: a.ref('SubscriptionProduct').array(),
                }),
            )
            .handler(a.handler.function(getProducts))
            .authorization((allow) => [allow.guest(), allow.authenticated()]),

        CreateCheckoutSession: a
            .query()
            .arguments({
                productId: a.string(),
                priceId: a.string(),
                userId: a.string(),
                organizationId: a.string(),
                successUrl: a.string(),
                cancelUrl: a.string(),
                includeTrial: a.boolean(),
                baseUrl: a.string(),
            })
            .returns(
                a.customType({
                    sessionId: a.string(),
                    url: a.string(),
                }),
            )
            .handler(a.handler.function(createCheckoutSession))
            .authorization((allow) => allow.authenticated()),

        CreateBillingPortal: a
            .query()
            .arguments({
                userId: a.string(),
                organizationId: a.string(),
                returnUrl: a.string(),
                baseUrl: a.string(),
            })
            .returns(
                a.customType({
                    url: a.string(),
                }),
            )
            .handler(a.handler.function(createBillingPortal))
            .authorization((allow) => allow.authenticated()),

        EndTrialEarly: a
            .query()
            .arguments({
                userId: a.string(),
                organizationId: a.string(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    subscriptionId: a.string(),
                    newStatus: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(endTrialEarly))
            .authorization((allow) => allow.authenticated()),

        SendEmail: a
            .mutation()
            .arguments({
                type: a.enum(['contact', 'notification', 'welcome']),
                recipientEmail: a.email(),
                data: a.json().required(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(sendEmail))
            .authorization((allow) => [allow.groups(['admins'])]),

        SendContactForm: a
            .mutation()
            .arguments({
                name: a.string().required(),
                email: a.email().required(),
                message: a.string().required(),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(sendContactForm))
            .authorization((allow) => [allow.guest(), allow.authenticated()]),

        // ── Models ───────────────────────────────────────────────────────────

        Profile: a
            .model({
                email: a.string().required(),
                createdAt: a.datetime(),
                newsLetter: a.boolean().authorization((allow) => [allow.owner().to(['read', 'update'])]),
                // User-level trial eligibility gate. PER-USER, not per-org — otherwise a
                // single user could spin up unlimited orgs and get unlimited 7-day trials.
                // Owner can READ (drives the frontend "Start free trial" CTA) but NOT
                // update — only the trusted Lambdas can flip this, via the schema-level
                // allow.resource() block below (postConfirmation initializes to false,
                // paymentProcessor flips to true on first trialing subscription,
                // createCheckoutSession reads it as the gate).
                hasUsedTrial: a
                    .boolean()
                    .default(false)
                    .authorization((allow) => [allow.owner().to(['read'])]),
                owner: a.string().authorization((allow) => [allow.owner().to(['read'])]),
            })
            .authorization((allow) => allow.owner().to(['read', 'update']))
            .secondaryIndexes((index) => [index('email')]),

        Organization: a
            .model({
                name: a.string().required(),
                // Owner can READ their own ownerId but not UPDATE it directly from
                // the client. The transferOwnership Lambda (in allow.resource() at
                // the schema level) is the only legitimate path to change this —
                // it runs with elevated permissions as a trusted backend resource.
                // Fixes the "owners may reassign ownership" build warning.
                ownerId: a.string().required().authorization((allow) => [
                    allow.ownerDefinedIn('ownerId').to(['read']),
                ]),
                stripeCustomerId: a.string(),
                planTier: a.enum(['free', 'basic', 'professional', 'enterprise']),
                planSource: a.enum(['stripe', 'grant', 'manual']),
                maxDevices: a.integer().default(1),
                cancelAtPeriodEnd: a.boolean().default(false),
                currentPeriodEnd: a.datetime(),
                // Stripe subscription state. Drives the "Past Due" / "Trial" / "Active"
                // badges in the frontend. Written by paymentProcessor on subscription.updated.
                subscriptionStatus: a.string(),
                scheduledDowngradeTier: a.string(),
                scheduledDowngradeDate: a.datetime(),
                deletedAt: a.datetime(),
                deletesTtl: a.integer(),
                // For care center-plan / promo orgs (planTier === 'free'): when this grant expires.
                // null = indefinite access. Set at redemption time from PromoCode.expiresInDays,
                // or set to a past time by an admin to revoke. Enforced by claimDeviceCapacity
                // and validateDeviceCapacity. Ignored for paid orgs.
                grantExpiresAt: a.datetime(),
                memberships: a.hasMany('Membership', ['organizationId']),
            })
            .authorization((allow) => [allow.ownerDefinedIn('ownerId')])
            .secondaryIndexes((index) => [index('ownerId'), index('stripeCustomerId')]),

        Membership: a
            .model({
                // Member can READ their own userId but not UPDATE it. Memberships
                // are created or deleted, never re-pointed at a different user,
                // so no Lambda needs write access to this field. Fixes the
                // "owners may reassign ownership" build warning.
                userId: a.string().required().authorization((allow) => [
                    allow.ownerDefinedIn('userId').to(['read']),
                ]),
                organizationId: a.string().required(),
                role: a.enum(['owner', 'admin', 'viewer']),
                organization: a.belongsTo('Organization', ['organizationId']),
            })
            .authorization((allow) => [allow.ownerDefinedIn('userId')])
            .secondaryIndexes((index) => [index('userId'), index('organizationId')]),

        Building: a
            .model({
                organizationId: a.string().required(),
                name: a.string().required(),
                addressLine1: a.string(),
                addressLine2: a.string(),
                city: a.string(),
                state: a.string(),
                postalCode: a.string(),
                timezone: a.string().default('America/New_York'),
                status: a.enum(['active', 'inactive']),
            })
            .authorization((allow) => [allow.authenticated()])
            .secondaryIndexes((index) => [index('organizationId')]),

        Device: a
            .model({
                organizationId: a.string().required(),
                buildingId: a.string(),
                deviceId: a.string().required(),
                serialNumber: a.string(),
                name: a.string().required(),
                locationLabel: a.string(),
                status: a.enum(['online', 'offline', 'needs_attention', 'inactive']),
                lastSeenAt: a.datetime(),
                firmwareVersion: a.string(),
            })
            .authorization((allow) => [allow.authenticated()])
            .secondaryIndexes((index) => [index('organizationId'), index('buildingId'), index('deviceId')]),

        Participant: a
            .model({
                organizationId: a.string().required(),
                buildingId: a.string(),
                displayName: a.string().required(),
                externalId: a.string(),
                status: a.enum(['active', 'inactive']),
                wanderRisk: a.enum(['low', 'medium', 'high']),
                notes: a.string(),
            })
            .authorization((allow) => [allow.authenticated()])
            .secondaryIndexes((index) => [index('organizationId'), index('buildingId')]),

        RfidTag: a
            .model({
                organizationId: a.string().required(),
                buildingId: a.string(),
                tagUid: a.string().required(),
                assignmentStatus: a.enum(['unassigned', 'assigned', 'lost', 'retired']),
                participantId: a.string(),
                lastSeenAt: a.datetime(),
            })
            .authorization((allow) => [allow.authenticated()])
            .secondaryIndexes((index) => [index('organizationId'), index('buildingId'), index('tagUid')]),

        Alert: a
            .model({
                organizationId: a.string().required(),
                buildingId: a.string(),
                deviceId: a.string(),
                tagUid: a.string(),
                participantId: a.string(),
                status: a.enum(['open', 'acknowledged', 'resolved', 'false_alarm']),
                severity: a.enum(['low', 'medium', 'high']),
                triggeredAt: a.datetime().required(),
                acknowledgedAt: a.datetime(),
                acknowledgedBy: a.string(),
                resolvedAt: a.datetime(),
                locationLabel: a.string(),
                message: a.string(),
            })
            .authorization((allow) => [allow.authenticated()])
            .secondaryIndexes((index) => [index('organizationId'), index('buildingId'), index('status')]),

        DeviceActivation: a
            .model({
                userId: a.string().required(),
                deviceId: a.string().required(),
                deviceName: a.string(),
                organizationId: a.string().required(),
                activatedAt: a.datetime().required(),
                lastValidatedAt: a.datetime().required(),
            })
            .identifier(['userId', 'deviceId'])
            .authorization((allow) => [allow.authenticated().to([])])
            .secondaryIndexes((index) => [index('organizationId'), index('userId')]),

        // Single-use or multi-use promo code that grants a free org ("plan grant").
        // The 'free' tier is hidden by default — promo redemption is the only path to it.
        // Two timestamps with different meanings:
        //   expiresAt    — when the CODE link stops accepting new redemptions
        //   expiresInDays — grant duration stamped onto each redeemed org as Organization.grantExpiresAt
        // Both are independent. See backend/scripts/create-promo-code.ts for usage.
        PromoCode: a
            .model({
                code: a.string().required(),
                label: a.string(),               // ops-only label, e.g. "Springer care center"
                maxRedemptions: a.integer().default(1),
                redemptionCount: a.integer().default(0),
                expiresAt: a.datetime(),         // null = code never expires
                expiresInDays: a.integer(),      // null = redeemers get indefinite access
                planTier: a.enum(['free', 'basic', 'professional', 'enterprise']),
                maxDevices: a.integer(),
            })
            .identifier(['code'])
            .authorization((allow) => [allow.authenticated().to([])]),

        AdminPlanAudit: a
            .model({
                organizationId: a.string().required(),
                actorUserId: a.string(),
                action: a.string().required(),
                oldPlanTier: a.string(),
                newPlanTier: a.string(),
                oldPlanSource: a.string(),
                newPlanSource: a.string(),
                oldMaxSeats: a.integer(),
                newMaxSeats: a.integer(),
                oldGrantExpiresAt: a.datetime(),
                newGrantExpiresAt: a.datetime(),
                reason: a.string(),
            })
            .authorization((allow) => [allow.authenticated().to([])])
            .secondaryIndexes((index) => [index('organizationId')]),

        // One row per (code, user) redemption. Composite identifier prevents the same
        // user from redeeming the same code twice (e.g. on a refresh during signup).
        // Atomic counter on PromoCode.redemptionCount handles concurrent writes.
        PromoRedemption: a
            .model({
                code: a.string().required(),
                userId: a.string().required(),
                organizationId: a.string().required(),
                redeemedAt: a.datetime().required(),
            })
            .identifier(['code', 'userId'])
            .authorization((allow) => [allow.authenticated().to([])])
            .secondaryIndexes((index) => [index('userId'), index('code')]),

        EmailSuppressionList: a
            .model({
                email: a.string().required(),
                reason: a.string().required(),
                bounceType: a.string(),
                bounceSubType: a.string(),
                complaintFeedbackType: a.string(),
                originalError: a.string(),
                suppressedAt: a.datetime().required(),
                expiresAt: a.datetime(),
            })
            .identifier(['email'])
            .authorization((allow) => [allow.authenticated().to([])])
            .secondaryIndexes((index) => [index('suppressedAt')]),

        Invitation: a
            .model({
                tokenHash: a.string().required(),
                organizationId: a.string().required(),
                email: a.string().required(),
                role: a.enum(['admin', 'viewer']),
                status: a.enum(['pending', 'accepted', 'declined']),
                invitedBy: a.string().required(),
                expiresAt: a.datetime().required(),
                ttl: a.integer(),
            })
            .identifier(['tokenHash'])
            .authorization((allow) => [allow.authenticated().to([])])
            .secondaryIndexes((index) => [index('organizationId'), index('email')]),

        // ── Multi-org custom types ─────────────────────────────────────────

        UserOrgItem: a.customType({
            organizationId: a.string(),
            name: a.string(),
            planTier: a.string(),
            maxDevices: a.integer(),
            role: a.string(),
            membershipId: a.string(),
        }),

        OrgMemberItem: a.customType({
            membershipId: a.string(),
            userId: a.string(),
            email: a.string(),
            role: a.string(),
            joinedAt: a.string(),
        }),

        InvitationItem: a.customType({
            tokenHash: a.string(),
            email: a.string(),
            role: a.string(),
            status: a.string(),
            invitedBy: a.string(),
            inviterEmail: a.string(),
            organizationName: a.string(),
            createdAt: a.string(),
            expiresAt: a.string(),
        }),

        // ── Multi-org operations ───────────────────────────────────────────

        ListUserOrganizations: a
            .query()
            .returns(a.customType({ organizations: a.ref('UserOrgItem').array() }))
            .handler(a.handler.function(listUserOrganizations))
            .authorization((allow) => allow.authenticated()),

        SetupOrganization: a
            .mutation()
            .arguments({ name: a.string().required() })
            .returns(a.customType({ organizationId: a.string(), membershipId: a.string() }))
            .handler(a.handler.function(setupOrganization))
            .authorization((allow) => allow.authenticated()),

        ListOrgMembers: a
            .query()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ members: a.ref('OrgMemberItem').array() }))
            .handler(a.handler.function(listOrgMembers))
            .authorization((allow) => allow.authenticated()),

        InviteMember: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                email: a.string().required(),
                role: a.enum(['admin', 'viewer']),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(inviteMember))
            .authorization((allow) => allow.authenticated()),

        GetInvitationDetails: a
            .query()
            .arguments({ token: a.string().required() })
            .returns(a.ref('InvitationItem'))
            .handler(a.handler.function(getInvitationDetails))
            .authorization((allow) => [allow.guest(), allow.authenticated()]),

        AcceptInvitation: a
            .mutation()
            .arguments({ token: a.string().required() })
            .returns(a.customType({ success: a.boolean(), organizationId: a.string(), role: a.string(), message: a.string() }))
            .handler(a.handler.function(acceptInvitation))
            .authorization((allow) => allow.authenticated()),

        DeclineInvitation: a
            .mutation()
            .arguments({ token: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(declineInvitation))
            .authorization((allow) => allow.authenticated()),

        RemoveMember: a
            .mutation()
            .arguments({ organizationId: a.string().required(), membershipId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(removeMember))
            .authorization((allow) => allow.authenticated()),

        UpdateMemberRole: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                membershipId: a.string().required(),
                role: a.enum(['admin', 'viewer']),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(updateMemberRole))
            .authorization((allow) => allow.authenticated()),

        TransferOwnership: a
            .mutation()
            .arguments({ organizationId: a.string().required(), newOwnerMembershipId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(transferOwnership))
            .authorization((allow) => allow.authenticated()),

        FetchInvitations: a
            .query()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ invitations: a.ref('InvitationItem').array() }))
            .handler(a.handler.function(fetchInvitations))
            .authorization((allow) => allow.authenticated()),

        // Returns the caller's pending non-expired invitations across ALL orgs.
        // Caller email is read from Cognito server-side (NEVER from a client arg) so
        // signed-in users can't list someone else's invites by spoofing the email.
        // Powers the dashboard's "Invitations to You" panel + sidebar pending-count
        // badge for cold-signup users who never clicked the email link.
        ListMyInvitations: a
            .query()
            .returns(a.customType({ invitations: a.ref('InvitationItem').array() }))
            .handler(a.handler.function(listMyInvitations))
            .authorization((allow) => allow.authenticated()),

        RevokeInvitation: a
            .mutation()
            .arguments({ token: a.string().required(), organizationId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(revokeInvitation))
            .authorization((allow) => allow.authenticated()),

        RemoveOrganization: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                confirmName: a.string().required(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    message: a.string(),
                    deletedAt: a.string(),
                    expiresAt: a.string(),
                }),
            )
            .handler(a.handler.function(removeOrganization))
            .authorization((allow) => allow.authenticated()),

        RestoreOrganization: a
            .mutation()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(restoreOrganization))
            .authorization((allow) => allow.authenticated()),

        // Member self-removal. Owner cannot leave (must transfer first); last admin
        // cannot leave with non-admin members remaining; cascade-releases the leaving
        // user's device capacity in this org. See ORG_SYSTEM.md for the full rules.
        LeaveOrganization: a
            .mutation()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(leaveOrganization))
            .authorization((allow) => allow.authenticated()),

        ChangePlan: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                newPriceId: a.string().required(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    message: a.string(),
                    effectiveDate: a.string(),
                    newTier: a.string(),
                }),
            )
            .handler(a.handler.function(changePlan))
            .authorization((allow) => allow.authenticated()),

        PreviewPlanChange: a
            .query()
            .arguments({
                organizationId: a.string().required(),
                newPriceId: a.string().required(),
            })
            .returns(
                a.customType({
                    direction: a.string(),
                    prorationAmount: a.float(),
                    creditAmount: a.float(),
                    chargeAmount: a.float(),
                    newMonthlyAmount: a.float(),
                    currentMonthlyAmount: a.float(),
                    effectiveDate: a.string(),
                    periodEnd: a.string(),
                    // Downgrade-only fields. When the org has more active device device capacity
                    // than the target tier supports, the preview returns blocked=true and
                    // the dashboard renders an explanatory dialog instead of the proration
                    // breakdown. seatsUsed/newTierMaxSeats let the UI render exact numbers.
                    blocked: a.boolean(),
                    blockReason: a.string(),
                    seatsUsed: a.integer(),
                    newTierMaxSeats: a.integer(),
                }),
            )
            .handler(a.handler.function(previewPlanChange))
            .authorization((allow) => allow.authenticated()),

        CancelDowngrade: a
            .mutation()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(cancelDowngrade))
            .authorization((allow) => allow.authenticated()),

        // ── Web login-based seat management ───────────────────────────────

        // Reusable type for the "you've hit your per-user device limit" rejection
        // payload. Lists the user's currently-active devices in the org so the
        // web's LoginScreen can render a kick modal (Cursor / Linear pattern).
        KickableDevice: a.customType({
            deviceId: a.string(),
            deviceName: a.string(),
            lastValidatedAt: a.string(),
        }),

        ClaimDeviceCapacity: a
            .mutation()
            .arguments({
                deviceId: a.string().required(),
                deviceName: a.string().required(),
                organizationId: a.string(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    plan: a.string(),
                    orgName: a.string(),
                    organizationId: a.string(),
                    message: a.string(),
                    // Set when success === false. 'PER_USER_DEVICE_LIMIT' or 'ORG_SEAT_LIMIT'.
                    // The web client uses this to decide between rendering a kick modal
                    // or a "contact your admin" message.
                    errorCode: a.string(),
                    // Populated only when errorCode === 'PER_USER_DEVICE_LIMIT'. The user's
                    // existing devices that they could sign out from to free a slot.
                    kickableDevices: a.ref('KickableDevice').array(),
                }),
            )
            .handler(a.handler.function(claimDeviceCapacity))
            .authorization((allow) => allow.authenticated()),

        ValidateDeviceCapacity: a
            .query()
            .arguments({ deviceId: a.string().required() })
            .returns(
                a.customType({
                    valid: a.boolean(),
                    plan: a.string(),
                    orgName: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(validateDeviceCapacity))
            .authorization((allow) => allow.authenticated()),

        ReleaseDevice: a
            .mutation()
            .arguments({
                deviceId: a.string().required(),
                // Optional — when present, an org owner/admin is revoking another user's
                // device from the dashboard's Devices page. When absent, the caller is
                // releasing their own device (the web sign-out flow).
                targetUserId: a.string(),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(releaseDevice))
            .authorization((allow) => allow.authenticated()),

        // Returns one DeviceItem per active install in the org. Owners/admins see all
        // rows with email join; viewers see only their own (server-enforced).
        DeviceItem: a.customType({
            userId: a.string(),
            email: a.string(),
            deviceId: a.string(),
            deviceName: a.string(),
            activatedAt: a.string(),
            lastValidatedAt: a.string(),
            isOnline: a.boolean(),
        }),

        ListOrgDevices: a
            .query()
            .arguments({ organizationId: a.string().required() })
            .returns(
                a.customType({
                    devices: a.ref('DeviceItem').array(),
                    totalDevicesUsed: a.integer(),
                    maxDevices: a.integer(),
                }),
            )
            .handler(a.handler.function(listOrgDevices))
            .authorization((allow) => allow.authenticated()),

        // Replaces the dead getPlanUsage. Counts real DeviceActivation rows
        // (not Plan records) and includes the per-user device cap derived from tier.
        GetOrgUsage: a
            .query()
            .arguments({ organizationId: a.string().required() })
            .returns(
                a.customType({
                    planTier: a.string(),
                    seatsUsed: a.integer(),
                    maxDevices: a.integer(),
                    maxDevicesPerUser: a.integer(),
                }),
            )
            .handler(a.handler.function(getOrgUsage))
            .authorization((allow) => allow.authenticated()),

        // Redeem a promo code, creating a new "plan grant" org for the caller.
        // The 'free' tier is hidden by default — this is the only path to it.
        RedeemPromoCode: a
            .mutation()
            .arguments({ code: a.string().required() })
            .returns(
                a.customType({
                    success: a.boolean(),
                    organizationId: a.string(),
                    organizationName: a.string(),
                    grantExpiresAt: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(redeemPromoCode))
            .authorization((allow) => allow.authenticated()),

        // ── Web PKCE auth code exchange ───────────────────────────────────

        // ── Admin operations (Cognito 'admins' group only) ────────────────────
        // Schema-level auth via .authorization((allow) => [allow.groups(['admins'])])
        // matches the existing SendEmail precedent. Group membership is reconciled
        // by postAuthentication on every login from the ADMIN_EMAILS env var.

        // Reusable item types for admin tables
        AdminGrantItem: a.customType({
            organizationId: a.string(),
            organizationName: a.string(),
            ownerEmail: a.string(),
            planTier: a.string(),
            planSource: a.string(),
            maxDevices: a.integer(),
            createdAt: a.string(),
            grantExpiresAt: a.string(),
            status: a.string(),
            sourceCode: a.string(),
        }),
        AdminCodeItem: a.customType({
            code: a.string(),
            label: a.string(),
            maxRedemptions: a.integer(),
            redemptionCount: a.integer(),
            expiresAt: a.string(),
            expiresInDays: a.integer(),
            planTier: a.string(),
            maxDevices: a.integer(),
            createdAt: a.string(),
            status: a.string(),
        }),
        AdminUserSearchItem: a.customType({
            userId: a.string(),
            email: a.string(),
            createdAt: a.string(),
            orgCount: a.integer(),
            // Cognito status snapshot joined server-side from ListUsers so
            // the admin table can render a status badge without a second round-trip.
            enabled: a.boolean(),
            userStatus: a.string(),
            lastModifiedAt: a.string(),
        }),
        AdminUserOrgItem: a.customType({
            membershipId: a.string(),
            role: a.string(),
            organizationId: a.string(),
            organizationName: a.string(),
            planTier: a.string(),
            planSource: a.string(),
            grantExpiresAt: a.string(),
            deletedAt: a.string(),
        }),
        AdminUserRedemption: a.customType({
            code: a.string(),
            organizationId: a.string(),
            redeemedAt: a.string(),
        }),
        AdminUserDetail: a.customType({
            userId: a.string(),
            email: a.string(),
            createdAt: a.string(),
            newsLetter: a.boolean(),
            // Cognito status joined from AdminGetUser so the admin detail page
            // can render a proper status badge and decide which action buttons
            // to show (e.g. hide "Unblock" unless enabled === false).
            enabled: a.boolean(),
            userStatus: a.string(),
            lastModifiedAt: a.string(),
        }),
        AdminOrgSearchItem: a.customType({
            organizationId: a.string(),
            name: a.string(),
            ownerId: a.string(),
            ownerEmail: a.string(),
            planTier: a.string(),
            planSource: a.string(),
            subscriptionStatus: a.string(),
            stripeCustomerId: a.string(),
            maxDevices: a.integer(),
            seatsUsed: a.integer(),
            deviceCount: a.integer(),
            grantExpiresAt: a.string(),
            memberCount: a.integer(),
            deletedAt: a.string(),
        }),
        AdminOrgMember: a.customType({
            membershipId: a.string(),
            userId: a.string(),
            email: a.string(),
            role: a.string(),
        }),
        AdminOrgDevice: a.customType({
            userId: a.string(),
            deviceId: a.string(),
            deviceName: a.string(),
            activatedAt: a.string(),
            lastValidatedAt: a.string(),
            organizationId: a.string(),
        }),
        AdminOrgDetail: a.customType({
            id: a.string(),
            name: a.string(),
            ownerId: a.string(),
            stripeCustomerId: a.string(),
            planTier: a.string(),
            planSource: a.string(),
            maxDevices: a.integer(),
            seatsUsed: a.integer(),
            deviceCount: a.integer(),
            subscriptionStatus: a.string(),
            cancelAtPeriodEnd: a.boolean(),
            currentPeriodEnd: a.string(),
            scheduledDowngradeTier: a.string(),
            scheduledDowngradeDate: a.string(),
            grantExpiresAt: a.string(),
            deletedAt: a.string(),
            createdAt: a.string(),
        }),
        AdminPlanAuditItem: a.customType({
            id: a.string(),
            organizationId: a.string(),
            actorUserId: a.string(),
            action: a.string(),
            oldPlanTier: a.string(),
            newPlanTier: a.string(),
            oldPlanSource: a.string(),
            newPlanSource: a.string(),
            oldMaxSeats: a.integer(),
            newMaxSeats: a.integer(),
            oldGrantExpiresAt: a.string(),
            newGrantExpiresAt: a.string(),
            reason: a.string(),
            createdAt: a.string(),
        }),

        AdminListGrants: a
            .query()
            .returns(
                a.customType({
                    grants: a.ref('AdminGrantItem').array(),
                    totalActive: a.integer(),
                    totalExpiringSoon: a.integer(),
                    totalEverGranted: a.integer(),
                }),
            )
            .handler(a.handler.function(adminListGrants))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminUpdateGrant: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                action: a.string().required(), // 'revoke' | 'extend' | 'permanent' | 'set-custom'
                extensionDays: a.integer(),
                customExpiresAt: a.string(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    grantExpiresAt: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(adminUpdateGrant))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminGrantOrg: a
            .mutation()
            .arguments({
                targetUserId: a.string().required(),
                expiresInDays: a.integer(),
                planTier: a.string(),
                maxDevices: a.integer(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    organizationId: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(adminGrantOrg))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminUpdateOrgPlan: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                planTier: a.string().required(),
                planSource: a.string(),
                maxDevices: a.integer(),
                grantExpiresAt: a.string(),
                reason: a.string(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(adminUpdateOrgPlan))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminListCodes: a
            .query()
            .returns(a.customType({ codes: a.ref('AdminCodeItem').array() }))
            .handler(a.handler.function(adminListCodes))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminCreateCode: a
            .mutation()
            .arguments({
                label: a.string(),
                maxRedemptions: a.integer(),
                expiresInDays: a.integer(),
                codeExpiresInDays: a.integer(),
                planTier: a.string(),
                maxDevices: a.integer(),
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    code: a.string(),
                    message: a.string(),
                }),
            )
            .handler(a.handler.function(adminCreateCode))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminRevokeCode: a
            .mutation()
            .arguments({ code: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminRevokeCode))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminSearchUsers: a
            .query()
            .arguments({ query: a.string() })
            .returns(a.customType({ users: a.ref('AdminUserSearchItem').array() }))
            .handler(a.handler.function(adminSearchUsers))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminGetUser: a
            .query()
            .arguments({ userId: a.string().required() })
            .returns(
                a.customType({
                    user: a.ref('AdminUserDetail'),
                    organizations: a.ref('AdminUserOrgItem').array(),
                    redemptions: a.ref('AdminUserRedemption').array(),
                }),
            )
            .handler(a.handler.function(adminGetUser))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminSearchOrgs: a
            .query()
            .arguments({ query: a.string() })
            .returns(a.customType({ organizations: a.ref('AdminOrgSearchItem').array() }))
            .handler(a.handler.function(adminSearchOrgs))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminGetOrg: a
            .query()
            .arguments({ organizationId: a.string().required() })
            .returns(
                a.customType({
                    organization: a.ref('AdminOrgDetail'),
                    members: a.ref('AdminOrgMember').array(),
                    devices: a.ref('AdminOrgDevice').array(),
                    auditLog: a.ref('AdminPlanAuditItem').array(),
                }),
            )
            .handler(a.handler.function(adminGetOrg))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminUpdateOrgMemberRole: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                membershipId: a.string().required(),
                role: a.string().required(),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminUpdateOrgMemberRole))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminRemoveOrgMember: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                membershipId: a.string().required(),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminRemoveOrgMember))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminReleaseOrgDevice: a
            .mutation()
            .arguments({
                organizationId: a.string().required(),
                userId: a.string().required(),
                deviceId: a.string().required(),
            })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminReleaseOrgDevice))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminRestoreOrg: a
            .mutation()
            .arguments({ organizationId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminRestoreOrg))
            .authorization((allow) => [allow.groups(['admins'])]),

        // ── Admin user management mutations ───────────────────────────────────
        // Standard industry operations: block, unblock, force sign-out, reset
        // password, delete. All single-user, all gated by the admins group
        // (schema level) + requireAdmin() runtime check (defense in depth).

        AdminDisableUser: a
            .mutation()
            .arguments({ userId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminDisableUser))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminEnableUser: a
            .mutation()
            .arguments({ userId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminEnableUser))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminSignOutUser: a
            .mutation()
            .arguments({ userId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminSignOutUser))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminResetUserPassword: a
            .mutation()
            .arguments({ userId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminResetUserPassword))
            .authorization((allow) => [allow.groups(['admins'])]),

        AdminDeleteUser: a
            .mutation()
            .arguments({ userId: a.string().required() })
            .returns(a.customType({ success: a.boolean(), message: a.string() }))
            .handler(a.handler.function(adminDeleteUser))
            .authorization((allow) => [allow.groups(['admins'])]),

        // Reports the caller's currently-active sign-in methods so the
        // settings UI can render the right Connect/Disconnect buttons.
        GetAuthMethods: a
            .query()
            .returns(
                a.customType({
                    linkedProviders: a.string().array()
                })
            )
            .handler(a.handler.function(getAuthMethods))
            .authorization((allow) => allow.authenticated()),

        // Disconnect a federated identity (e.g. Google) from the caller's
        // native account. Always requires newPassword — the password gets set
        // on the native user before the unlink, ensuring email + password
        // sign-in works immediately afterward (regardless of whether the
        // current password is one the user knows or the server-generated
        // random one PreSignUp issued for Google-first sign-ups).
        DisconnectProvider: a
            .mutation()
            .arguments({
                providerName: a.string().required(),
                newPassword: a.string().required()
            })
            .returns(
                a.customType({
                    success: a.boolean(),
                    message: a.string()
                })
            )
            .handler(a.handler.function(disconnectProvider))
            .authorization((allow) => allow.authenticated()),
    })
    .authorization((allow) => [
        allow.resource(postConfirmation),
        allow.resource(postAuthentication),
        allow.resource(paymentProcessor),
        allow.resource(createCheckoutSession),
        allow.resource(createBillingPortal),
        allow.resource(endTrialEarly),
        allow.resource(getProducts),
        allow.resource(handleSesNotification),
        allow.resource(listUserOrganizations),
        allow.resource(setupOrganization),
        allow.resource(listOrgMembers),
        allow.resource(inviteMember),
        allow.resource(getInvitationDetails),
        allow.resource(acceptInvitation),
        allow.resource(declineInvitation),
        allow.resource(removeMember),
        allow.resource(updateMemberRole),
        allow.resource(transferOwnership),
        allow.resource(fetchInvitations),
        allow.resource(listMyInvitations),
        allow.resource(revokeInvitation),
        allow.resource(removeOrganization),
        allow.resource(restoreOrganization),
        allow.resource(leaveOrganization),
        allow.resource(changePlan),
        allow.resource(previewPlanChange),
        allow.resource(cancelDowngrade),
        allow.resource(claimDeviceCapacity),
        allow.resource(validateDeviceCapacity),
        allow.resource(releaseDevice),
        allow.resource(listOrgDevices),
        allow.resource(getOrgUsage),
        allow.resource(redeemPromoCode),
        allow.resource(adminListGrants),
        allow.resource(adminUpdateGrant),
        allow.resource(adminGrantOrg),
        allow.resource(adminUpdateOrgPlan),
        allow.resource(adminListCodes),
        allow.resource(adminCreateCode),
        allow.resource(adminRevokeCode),
        allow.resource(adminSearchUsers),
        allow.resource(adminGetUser),
        allow.resource(adminSearchOrgs),
        allow.resource(adminGetOrg),
        allow.resource(adminUpdateOrgMemberRole),
        allow.resource(adminRemoveOrgMember),
        allow.resource(adminReleaseOrgDevice),
        allow.resource(adminRestoreOrg),
        allow.resource(adminDisableUser),
        allow.resource(adminEnableUser),
        allow.resource(adminSignOutUser),
        allow.resource(adminResetUserPassword),
        allow.resource(adminDeleteUser),
        allow.resource(getAuthMethods),
        allow.resource(disconnectProvider),
    ]);

export type Schema = ClientSchema<typeof schema>;

const buildEnv = process.env.BUILD_ENV;
if (!buildEnv) {
    throw new Error('BUILD_ENV is required. Set it in backend/.env before running the Amplify sandbox.');
}

export const data = defineData({
    name: `wanderaware-${buildEnv}`,
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool',    },
});
