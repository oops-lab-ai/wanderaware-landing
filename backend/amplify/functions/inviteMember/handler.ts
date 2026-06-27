import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/inviteMember';
import { Schema } from '../../data/resource';
import { randomBytes, createHash } from 'node:crypto';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();
const sesClient = new SESClient({});

export const handler: Schema['InviteMember']['functionHandler'] = async (event) => {
    const { organizationId, email, role } = event.arguments;
    const callerId = (event as any).identity?.sub as string;

    if (!callerId) {
        throw new Error('Unauthorized');
    }

    // Normalize + validate email up front so a typo never reaches DDB or SES.
    // Mirrors the frontend regex; defense-in-depth for callers that bypass the UI.
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error('Invalid email address');
    }

    // Verify caller is owner or admin
    const memberships = await client.models.Membership.listMembershipByOrganizationId({ organizationId });
    const callerMembership = memberships.data?.find((m) => m.userId === callerId);
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
        throw new Error('Unauthorized: not an owner or admin of this organization');
    }

    // Caller can't invite themselves.
    const callerProfile = await client.models.Profile.get({ id: callerId });
    if (callerProfile.data?.email?.toLowerCase() === normalizedEmail) {
        throw new Error("You can't invite yourself");
    }

    // Admins can only invite viewers (not other admins) — only owners can invite admins
    if (callerMembership.role === 'admin' && role === 'admin') {
        throw new Error('Admins can only invite viewers. Only the organization owner can invite admins.');
    }

    // Check if email is already a member of this org
    const orgMemberships = memberships.data ?? [];
    for (const m of orgMemberships) {
        const profileResult = await client.models.Profile.get({ id: m.userId });
        if (profileResult.data?.email?.toLowerCase() === normalizedEmail) {
            throw new Error('Already a member');
        }
    }

    // Revoke any existing pending invitations for same org+email
    const existingInvitations = await client.models.Invitation.listInvitationByOrganizationId({ organizationId });
    for (const inv of existingInvitations.data ?? []) {
        if (inv.email?.toLowerCase() === normalizedEmail && inv.status === 'pending') {
            await client.models.Invitation.delete({ tokenHash: inv.tokenHash });
        }
    }

    // Generate token
    const token = `ms_inv_${randomBytes(16).toString('hex')}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Calculate expiration (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create Invitation record
    await client.models.Invitation.create({
        tokenHash,
        organizationId,
        email: normalizedEmail,
        role: role ?? 'viewer',
        status: 'pending',
        invitedBy: callerId,
        expiresAt,
        ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days from now
    });

    // Send invitation email via SES (if configured)
    if (process.env.SENDER_EMAIL) {
        try {
            // HTML-escape user-controlled strings to prevent injection
            const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

            const orgResult = await client.models.Organization.get({ id: organizationId });
            const orgName = escapeHtml(orgResult.data?.name ?? 'your organization');

            const inviterProfile = await client.models.Profile.get({ id: callerId });
            const inviterEmail = escapeHtml(inviterProfile.data?.email ?? 'a team member');

            const inviteUrl = `${process.env.FRONTEND_URL}/dashboard/invite?token=${token}`;
            const logoUrl = '';
            const assignedRole = role ?? 'viewer';

            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #d4d0c8;
            background: #050507;
            padding: 0;
            margin: 0;
        }

        @media only screen and (max-width: 600px) {
            .email-wrapper {
                border-radius: 0 !important;
                margin: 0 !important;
            }

            .header {
                padding: 32px 24px !important;
            }

            .logo-text {
                font-size: 28px !important;
            }

            .content {
                padding: 32px 24px !important;
            }

            .greeting {
                font-size: 24px !important;
            }

            .footer-link {
                display: block !important;
                margin: 8px 0 !important;
            }
        }
    </style>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #d4d0c8; background-color: #050507; padding: 0; margin: 0;">
    <!-- Email container -->
    <div style="background-color: #050507; padding: 20px;">
        <!-- Email wrapper -->
        <div style="max-width: 600px; margin: 0 auto; background-color: #0c0c11; border-radius: 16px; overflow: hidden; border: 1px solid #1c1c26;">

            <!-- Header -->
            <div style="text-align: center; padding: 48px 32px 40px; background-color: #08080c; border-bottom: 1px solid #1c1c26; position: relative;">
                <div style="margin-bottom: 16px;">
                    <img src="${logoUrl}" alt="WanderAware" style="width: 72px; height: 72px; border-radius: 16px; border: 2px solid #1c1c26; margin-bottom: 16px;">
                    <div style="font-family: 'Outfit', system-ui, sans-serif; font-size: 36px; font-weight: 700; color: #ece8e0; letter-spacing: -1px;">
                        WanderAware
                    </div>
                </div>
                <div style="color: #6b6770; font-family: 'Inter', sans-serif; font-size: 14px; margin-top: 8px; font-weight: 500; letter-spacing: 0.5px;">
                    Metabolomics Data Analysis
                </div>
                <!-- Nav tag badge -->
                <div style="display: inline-block; margin-top: 16px; padding: 5px 14px; border: 1px solid rgba(232, 168, 124, 0.3); border-radius: 4px; background-color: rgba(232, 168, 124, 0.06);">
                    <span style="font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; color: #e8a87c; text-transform: uppercase; letter-spacing: 2px;">TEAM INVITATION</span>
                </div>
            </div>

            <!-- Content -->
            <div style="padding: 48px 40px;">
                <h2 style="font-family: 'Outfit', system-ui, sans-serif; font-size: 28px; font-weight: 800; color: #ece8e0; margin-bottom: 8px; line-height: 1.2;">
                    You've Been Invited
                </h2>
                <p style="color: #6b6770; font-size: 16px; line-height: 1.6; margin-bottom: 32px; font-weight: 400;">
                    You've been invited to join <strong style="color: #e0dbd5;">${orgName}</strong> on WanderAware. Accept the invitation below to get started with adult day care wandering awareness.
                </p>

                <!-- Invitation details card -->
                <div style="background-color: #111118; border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid #1c1c26;">
                    <div style="font-family: 'IBM Plex Mono', monospace; color: #6b6770; font-size: 11px; text-transform: uppercase; margin-bottom: 20px; font-weight: 600; letter-spacing: 2px; text-align: center;">
                        Invitation Details
                    </div>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 12px 0; vertical-align: top; width: 100px;">
                                <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #6b6770; text-transform: uppercase; letter-spacing: 1px;">Role</span>
                            </td>
                            <td style="padding: 12px 0;">
                                <span style="display: inline-block; padding: 4px 12px; border: 1px solid rgba(232, 168, 124, 0.3); border-radius: 4px; background-color: rgba(232, 168, 124, 0.06); font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #e8a87c; text-transform: uppercase; letter-spacing: 1px;">${assignedRole}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0; vertical-align: top; width: 100px; border-top: 1px solid #1c1c26;">
                                <span style="font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 600; color: #6b6770; text-transform: uppercase; letter-spacing: 1px;">Invited by</span>
                            </td>
                            <td style="padding: 12px 0; border-top: 1px solid #1c1c26;">
                                <span style="color: #e0dbd5; font-size: 14px;">${inviterEmail}</span>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- CTA button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #e8a87c; color: #050507; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-family: 'Outfit', system-ui, sans-serif; font-weight: 700; font-size: 16px; letter-spacing: 0.3px;">
                        Accept Invitation
                    </a>
                </div>

                <!-- Expiry notice -->
                <div style="background-color: #111118; border-left: 3px solid #e8a87c; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 32px 0;">
                    <p style="margin: 0; color: #6b6770; font-size: 13px; line-height: 1.6;">
                        This invitation expires in <strong style="color: #e0dbd5;">7 days</strong>. If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                </div>

                <!-- Link fallback -->
                <p style="color: #4a4650; font-size: 12px; line-height: 1.6; margin-top: 24px; text-align: center;">
                    If the button above doesn't work, copy and paste this link into your browser:<br>
                    <a href="${inviteUrl}" style="color: #e8a87c; text-decoration: none; word-break: break-all; font-family: 'IBM Plex Mono', monospace; font-size: 11px;">${inviteUrl}</a>
                </p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 40px; background-color: #08080c; border-top: 1px solid #1c1c26;">
                <img src="${logoUrl}" alt="WanderAware" style="width: 36px; height: 36px; margin-bottom: 16px; opacity: 0.6; border-radius: 8px;">
                <p style="color: #6b6770; font-size: 14px; margin-bottom: 8px;">
                    <strong style="color: #d4d0c8;">Need help?</strong> We're here for you.
                </p>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #1c1c26;">
                    <a href="https://wanderaware.com" style="color: #e8a87c; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Visit Website</a>
                    <a href="mailto:oopslabai@gmail.com" style="color: #e8a87c; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Contact Us</a>
                </div>

                <p style="color: #4a4650; font-size: 12px; margin-top: 24px; font-family: 'IBM Plex Mono', monospace;">
                    &copy; 2026 WanderAware by WanderAware. All rights reserved.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
            `.trim();

            const sendEmailParams: any = {
                Source: process.env.SENDER_EMAIL,
                Destination: {
                    ToAddresses: [normalizedEmail],
                },
                Message: {
                    Subject: {
                        Charset: 'UTF-8',
                        Data: `You've been invited to join ${orgName} on WanderAware`,
                    },
                    Body: {
                        Html: {
                            Charset: 'UTF-8',
                            Data: htmlBody,
                        },
                    },
                },
            };

            if (process.env.SES_CONFIGURATION_SET_NAME) {
                sendEmailParams.ConfigurationSetName = process.env.SES_CONFIGURATION_SET_NAME;
            }

            await sesClient.send(new SendEmailCommand(sendEmailParams));
            console.log(`Invitation email sent to ${normalizedEmail} for org ${organizationId}`);
        } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
            // Don't throw — the invite record was already created, clipboard fallback works
        }
    }

    // Return token in message field (clipboard fallback)
    return { success: true, message: token };
};
