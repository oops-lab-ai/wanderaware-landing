import type { CustomMessageTriggerHandler } from 'aws-lambda';

/**
 * Custom Message Lambda Trigger for AWS Cognito
 * WanderAware branded email templates
 *
 * Brand: Dark background (#0a0e17), indigo accent (#6366f1), cyan (#22d3ee)
 * Fonts: Inter (all text)
 */
export const handler: CustomMessageTriggerHandler = async (event) => {
    console.log('CustomMessage trigger invoked:', event.triggerSource);

    const accent = '#6366f1';
    const accentSoft = 'rgba(99, 102, 241, 0.15)';
    const accentBorder = 'rgba(99, 102, 241, 0.3)';
    const cyan = '#22d3ee';
    const emerald = '#34d399';
    const bg = '#0a0e17';
    const bgCard = '#111827';
    const bgCardAlt = '#0f1629';
    const border = '#1e293b';
    const text = '#f1f5f9';
    const textSecondary = '#94a3b8';
    const textMuted = '#64748b';

    if (event.triggerSource === 'CustomMessage_SignUp' || event.triggerSource === 'CustomMessage_ResendCode') {
        const code = event.request.codeParameter;
        const isResend = event.triggerSource === 'CustomMessage_ResendCode';

        event.response.emailSubject = isResend
            ? 'WanderAware - Your New Verification Code'
            : 'Welcome to WanderAware - Verify Your Account';

        event.response.emailMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: ${text}; background-color: ${bg}; padding: 0; margin: 0;">
    <div style="background-color: ${bg}; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: ${bgCard}; border-radius: 16px; overflow: hidden; border: 1px solid ${border};">

            <!-- Header -->
            <div style="text-align: center; padding: 48px 32px 40px; background-color: ${bgCardAlt}; border-bottom: 1px solid ${border};">
                <div style="font-size: 32px; font-weight: 800; color: ${text}; letter-spacing: -1px;">
                    Master<span style="color: ${accent};">Metabolomics</span>
                </div>
                <div style="color: ${textMuted}; font-size: 14px; margin-top: 8px; font-weight: 500;">
                    Web Metabolomics Analysis
                </div>
                <div style="display: inline-block; margin-top: 16px; padding: 5px 14px; border: 1px solid ${accentBorder}; border-radius: 100px; background-color: ${accentSoft};">
                    <span style="font-size: 11px; font-weight: 600; color: ${accent}; text-transform: uppercase; letter-spacing: 1.5px;">${isResend ? 'CODE RESENT' : 'ACCOUNT VERIFICATION'}</span>
                </div>
            </div>

            <!-- Content -->
            <div style="padding: 48px 40px;">
                <h2 style="font-size: 28px; font-weight: 800; color: ${text}; margin-bottom: 8px; line-height: 1.2;">
                    ${isResend ? "Here's Your New Code" : 'Welcome Aboard'}
                </h2>
                <p style="color: ${textSecondary}; font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
                    ${isResend
                        ? "We've generated a fresh verification code for you. You're one step away from accessing your account."
                        : "You're about to unlock powerful adult day care wandering awareness. Let's verify your account and get started."}
                </p>

                <!-- Code -->
                <div style="background-color: ${bgCardAlt}; border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid ${border};">
                    <div style="color: ${textMuted}; font-size: 11px; text-transform: uppercase; margin-bottom: 16px; font-weight: 600; letter-spacing: 2px; text-align: center;">
                        Your Verification Code
                    </div>
                    <div style="background-color: ${bg}; border: 2px solid ${accentBorder}; border-radius: 12px; padding: 24px; text-align: center;">
                        <div style="font-family: monospace; font-size: 42px; font-weight: 700; color: ${accent}; letter-spacing: 8px;">
                            ${code}
                        </div>
                    </div>
                    <p style="color: ${textMuted}; font-size: 14px; margin: 20px 0 0; text-align: center;">
                        Enter this code in the verification page<br>
                        <span style="font-size: 12px;">Code expires in 24 hours</span>
                    </p>
                </div>

                <!-- Features -->
                <div style="background-color: ${bgCardAlt}; border-radius: 12px; padding: 28px; margin: 32px 0; border: 1px solid ${border};">
                    <h3 style="font-size: 18px; font-weight: 700; color: ${text}; margin-bottom: 20px;">
                        What's waiting for you
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 10px 0; vertical-align: top; width: 24px;">
                                <span style="color: ${cyan}; font-size: 14px;">&#10148;</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">
                                Interactive doorway alerts, tag assignments, and reader status
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; vertical-align: top; width: 24px;">
                                <span style="color: ${cyan}; font-size: 14px;">&#10148;</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">
                                Statistical testing with publication-ready results
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; vertical-align: top; width: 24px;">
                                <span style="color: ${cyan}; font-size: 14px;">&#10148;</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">
                                100% local processing — your data never leaves your machine
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; vertical-align: top; width: 24px;">
                                <span style="color: ${cyan}; font-size: 14px;">&#10148;</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">
                                Team and seat management for your care center
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- CTA -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://wanderaware.com/dashboard" style="display: inline-block; background-color: ${accent}; color: white; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px;">
                        Get Started
                    </a>
                </div>

                <!-- Security notice -->
                <div style="background-color: ${bgCardAlt}; border-left: 3px solid ${accent}; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 32px 0;">
                    <p style="margin: 0; color: ${textMuted}; font-size: 13px;">
                        If you didn't create a WanderAware account, you can safely ignore this email.
                    </p>
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 40px; background-color: ${bgCardAlt}; border-top: 1px solid ${border};">
                <p style="color: ${textMuted}; font-size: 14px; margin-bottom: 8px;">
                    <strong style="color: ${textSecondary};">Need help?</strong> We're here for you.
                </p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${border};">
                    <a href="https://wanderaware.com" style="color: ${accent}; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Visit Website</a>
                    <a href="mailto:support@wanderaware.com" style="color: ${accent}; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Contact Us</a>
                </div>
                <p style="color: ${textMuted}; font-size: 12px; margin-top: 24px;">
                    &copy; 2026 WanderAware. All rights reserved.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    if (event.triggerSource === 'CustomMessage_ForgotPassword') {
        const code = event.request.codeParameter;

        event.response.emailSubject = 'WanderAware - Reset Your Password';
        event.response.emailMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: ${text}; background-color: ${bg}; padding: 0; margin: 0;">
    <div style="background-color: ${bg}; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: ${bgCard}; border-radius: 16px; overflow: hidden; border: 1px solid ${border};">

            <!-- Header -->
            <div style="text-align: center; padding: 48px 32px 40px; background-color: ${bgCardAlt}; border-bottom: 1px solid ${border};">
                <div style="font-size: 32px; font-weight: 800; color: ${text}; letter-spacing: -1px;">
                    Master<span style="color: ${accent};">Metabolomics</span>
                </div>
                <div style="color: ${textMuted}; font-size: 14px; margin-top: 8px; font-weight: 500;">
                    Web Metabolomics Analysis
                </div>
                <div style="display: inline-block; margin-top: 16px; padding: 5px 14px; border: 1px solid rgba(251, 113, 133, 0.3); border-radius: 100px; background-color: rgba(251, 113, 133, 0.1);">
                    <span style="font-size: 11px; font-weight: 600; color: #fb7185; text-transform: uppercase; letter-spacing: 1.5px;">PASSWORD RESET</span>
                </div>
            </div>

            <!-- Content -->
            <div style="padding: 48px 40px;">
                <h2 style="font-size: 28px; font-weight: 800; color: ${text}; margin-bottom: 8px; line-height: 1.2;">
                    Password Reset Request
                </h2>
                <p style="color: ${textSecondary}; font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
                    We received a request to reset the password for your WanderAware account.
                    Use the code below to create a new password.
                </p>

                <!-- Warning -->
                <div style="background-color: ${bgCardAlt}; border-left: 3px solid #fb7185; border-radius: 0 8px 8px 0; padding: 16px 20px; margin: 32px 0;">
                    <p style="margin: 0; color: ${textSecondary}; font-size: 14px;">
                        <strong style="color: #fb7185;">Important:</strong> If you didn't request this, ignore this email. Your account is safe.
                    </p>
                </div>

                <!-- Code -->
                <div style="background-color: ${bgCardAlt}; border-radius: 16px; padding: 32px; margin: 32px 0; border: 1px solid ${border};">
                    <div style="color: ${textMuted}; font-size: 11px; text-transform: uppercase; margin-bottom: 16px; font-weight: 600; letter-spacing: 2px; text-align: center;">
                        Your Reset Code
                    </div>
                    <div style="background-color: ${bg}; border: 2px solid ${accentBorder}; border-radius: 12px; padding: 24px; text-align: center;">
                        <div style="font-family: monospace; font-size: 42px; font-weight: 700; color: ${accent}; letter-spacing: 8px;">
                            ${code}
                        </div>
                    </div>
                    <p style="color: ${textMuted}; font-size: 14px; margin: 20px 0 0; text-align: center;">
                        Enter this code on the password reset page<br>
                        <span style="font-size: 12px;">Code expires in 1 hour</span>
                    </p>
                </div>

                <!-- Steps -->
                <div style="background-color: ${bgCardAlt}; border-radius: 12px; padding: 28px; margin: 32px 0; border: 1px solid ${border};">
                    <h3 style="font-size: 18px; font-weight: 700; color: ${text}; margin-bottom: 20px;">
                        Reset Steps
                    </h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                            <td style="padding: 10px 0; width: 28px; vertical-align: top;">
                                <span style="display: inline-block; width: 22px; height: 22px; background: ${accentSoft}; border: 1px solid ${accentBorder}; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 600; color: ${accent};">1</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">Copy the reset code above</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 28px; vertical-align: top;">
                                <span style="display: inline-block; width: 22px; height: 22px; background: ${accentSoft}; border: 1px solid ${accentBorder}; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 600; color: ${accent};">2</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">Enter the code on the password reset page</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 28px; vertical-align: top;">
                                <span style="display: inline-block; width: 22px; height: 22px; background: ${accentSoft}; border: 1px solid ${accentBorder}; border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 600; color: ${accent};">3</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${textSecondary}; font-size: 15px;">Choose a strong new password</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; width: 28px; vertical-align: top;">
                                <span style="display: inline-block; width: 22px; height: 22px; background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 50%; text-align: center; line-height: 20px; font-size: 11px; font-weight: 600; color: ${emerald};">&#10003;</span>
                            </td>
                            <td style="padding: 10px 0; padding-left: 12px; color: ${emerald}; font-size: 15px;">You're back in!</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 40px; background-color: ${bgCardAlt}; border-top: 1px solid ${border};">
                <p style="color: ${textMuted}; font-size: 14px; margin-bottom: 8px;">
                    <strong style="color: ${textSecondary};">Need help?</strong> Our support team is here.
                </p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid ${border};">
                    <a href="https://wanderaware.com" style="color: ${accent}; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Visit Website</a>
                    <a href="mailto:support@wanderaware.com" style="color: ${accent}; text-decoration: none; font-weight: 500; margin: 0 12px; font-size: 14px;">Contact Us</a>
                </div>
                <p style="color: ${textMuted}; font-size: 12px; margin-top: 24px;">
                    &copy; 2026 WanderAware. All rights reserved.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    return event;
};
