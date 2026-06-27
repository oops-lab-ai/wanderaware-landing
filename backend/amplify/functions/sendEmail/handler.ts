import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { env } from '$amplify/env/sendEmail';

const sesClient = new SESClient({});

interface EmailEvent {
    arguments: {
        type: 'contact' | 'notification' | 'welcome';
        recipientEmail?: string;
        data: Record<string, any>;
    };
}

// Template definitions
const templates: Record<string, (data: any) => { subject: string; body: string; html?: string }> = {
    contact: (data) => ({
        subject: `New Contact Form Submission from ${data.name}`,
        body: `
New contact form submission received!

From: ${data.name}
Email: ${data.email}

Message:
${data.message || 'No message provided'}

---
This is an automated message from WanderAware Contact Form.
        `.trim()
    }),
    notification: (data) => ({
        subject: data.subject || 'New Notification',
        body: data.body || 'You have a new notification.'
    }),
    welcome: (data) => ({
        subject: 'Welcome to WanderAware!',
        body: `
Hi ${data.name},

Welcome to WanderAware! We're excited to have you on board.

---
The WanderAware Team
        `.trim()
    })
};

/** Strip CR/LF to prevent MIME header injection */
function sanitizeHeader(value: string): string {
    return value.replace(/[\r\n]/g, '');
}

/**
 * Build a MIME email with optional HTML content
 */
function buildMimeEmail(params: {
    from: string;
    to: string[];
    replyTo?: string;
    subject: string;
    body: string;
    html?: string;
}): string {
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    let email = '';
    email += `From: ${sanitizeHeader(params.from)}\r\n`;
    email += `To: ${params.to.map(sanitizeHeader).join(', ')}\r\n`;
    if (params.replyTo) {
        email += `Reply-To: ${sanitizeHeader(params.replyTo)}\r\n`;
    }
    email += `Subject: ${sanitizeHeader(params.subject)}\r\n`;
    email += `MIME-Version: 1.0\r\n`;

    if (params.html) {
        // Email with HTML (multipart/alternative for text + HTML)
        email += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

        // Plain text part
        email += `--${altBoundary}\r\n`;
        email += `Content-Type: text/plain; charset=UTF-8\r\n`;
        email += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
        email += `${params.body || 'Please view this email in an HTML-compatible email client.'}\r\n\r\n`;

        // HTML part
        email += `--${altBoundary}\r\n`;
        email += `Content-Type: text/html; charset=UTF-8\r\n`;
        email += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
        email += `${params.html}\r\n\r\n`;

        email += `--${altBoundary}--`;
    } else {
        // Plain text email
        email += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
        email += params.body;
    }

    return email;
}

export const handler = async (event: EmailEvent) => {
    const { type, recipientEmail, data } = event.arguments;

    if (!templates[type]) {
        throw new Error(`Unknown email type: ${type}`);
    }

    const { subject: rawSubject, body, html } = templates[type](data);

    // Add [DEV] prefix if sender indicates dev environment
    const isDev = env.SENDER_EMAIL.includes('dev.wanderaware.com');
    const subject = isDev ? `[DEV] ${rawSubject}` : rawSubject;

    const defaultRecipients = env.RECIPIENT_EMAILS.split(',').map((e: string) => e.trim());
    const recipients = recipientEmail ? [recipientEmail] : defaultRecipients;

    const replyTo = data.email && typeof data.email === 'string' ? data.email : undefined;

    // Get configuration set name if available (for bounce/complaint tracking)
    const configurationSetName = env.SES_CONFIGURATION_SET_NAME || undefined;

    try {
        const mimeEmail = buildMimeEmail({
            from: env.SENDER_EMAIL,
            to: recipients,
            replyTo,
            subject,
            body: body || 'Please view this email in an HTML-compatible email client.',
            html
        });

        await sesClient.send(
            new SendRawEmailCommand({
                RawMessage: {
                    Data: Buffer.from(mimeEmail)
                },
                Destinations: recipients,
                ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {})
            })
        );

        return { success: true, message: 'Email sent successfully' };
    } catch (error: unknown) {
        console.error('Failed to send email:', error);

        // Check if this is a suppression-related rejection from SES
        const errorName = error instanceof Error ? (error as { name?: string }).name : undefined;
        if (errorName === 'MessageRejected') {
            const errorMessage = error instanceof Error ? error.message : '';
            if (errorMessage.includes('suppression list')) {
                console.log('Email rejected due to SES account-level suppression');
                return {
                    success: false,
                    message: 'Email address is on suppression list due to previous bounce or complaint'
                };
            }
        }

        // Return a user-friendly error message for other errors
        const contactEmail = process.env.CONTACT_EMAIL || 'support@wanderaware.com';
        return {
            success: false,
            message: `Unable to send email automatically. Please email us directly at ${contactEmail}`
        };
    }
};
