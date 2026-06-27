import type { CustomMessageTriggerHandler } from 'aws-lambda';

const brand = {
    teal: '#176E68',
    orange: '#F97316',
    pale: '#E6F4F2',
    text: '#111827',
    muted: '#6B7280',
    border: '#D1E7E4',
    bg: '#F9FAFB',
    card: '#FFFFFF',
};

function emailShell(title: string, eyebrow: string, body: string) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.6; color: ${brand.text}; background: ${brand.bg}; padding: 0; margin: 0;">
    <div style="padding: 24px;">
        <div style="max-width: 600px; margin: 0 auto; background: ${brand.card}; border: 1px solid ${brand.border}; border-radius: 16px; overflow: hidden;">
            <div style="padding: 36px 32px 28px; background: ${brand.pale}; border-bottom: 1px solid ${brand.border};">
                <div style="font-size: 30px; font-weight: 800; color: ${brand.teal};">WanderAware</div>
                <div style="margin-top: 8px; color: ${brand.muted}; font-size: 14px;">Adult day care wandering awareness</div>
                <div style="display: inline-block; margin-top: 18px; padding: 5px 12px; border-radius: 999px; background: #fff; color: ${brand.orange}; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">${eyebrow}</div>
            </div>
            <div style="padding: 38px 32px;">
                <h1 style="font-size: 26px; line-height: 1.25; margin: 0 0 12px; color: ${brand.text};">${title}</h1>
                ${body}
                <p style="margin: 32px 0 0; color: ${brand.muted}; font-size: 13px;">If you did not request this email, you can safely ignore it.</p>
            </div>
            <div style="padding: 26px 32px; border-top: 1px solid ${brand.border}; color: ${brand.muted}; font-size: 13px;">
                <a href="https://wanderaware.com" style="color: ${brand.teal}; text-decoration: none; font-weight: 700;">wanderaware.com</a>
                <span style="margin: 0 8px;">|</span>
                <a href="mailto:support@wanderaware.com" style="color: ${brand.teal}; text-decoration: none; font-weight: 700;">support@wanderaware.com</a>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();
}

function codeBlock(code: string) {
    return `
<p style="color: ${brand.muted}; font-size: 16px; margin: 0 0 24px;">Use the code below to continue.</p>
<div style="background: ${brand.bg}; border: 1px solid ${brand.border}; border-radius: 14px; padding: 26px; text-align: center;">
    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 40px; font-weight: 800; color: ${brand.teal}; letter-spacing: 8px;">${code}</div>
</div>
    `.trim();
}

export const handler: CustomMessageTriggerHandler = async (event) => {
    console.log('CustomMessage trigger invoked:', event.triggerSource);

    if (event.triggerSource === 'CustomMessage_SignUp' || event.triggerSource === 'CustomMessage_ResendCode') {
        const code = event.request.codeParameter;
        const isResend = event.triggerSource === 'CustomMessage_ResendCode';
        event.response.emailSubject = isResend ? 'WanderAware verification code' : 'Welcome to WanderAware';
        event.response.emailMessage = emailShell(
            isResend ? 'Your new verification code' : 'Verify your WanderAware account',
            isResend ? 'Code resent' : 'Account verification',
            `${codeBlock(code)}<p style="color: ${brand.muted}; font-size: 15px; margin: 24px 0 0;">After verification, you can set up your care organization, buildings, RFID readers, tags, participants, alerts, team, and billing.</p>`,
        );
    }

    if (event.triggerSource === 'CustomMessage_ForgotPassword') {
        const code = event.request.codeParameter;
        event.response.emailSubject = 'WanderAware password reset';
        event.response.emailMessage = emailShell('Reset your password', 'Password reset', codeBlock(code));
    }

    return event;
};
