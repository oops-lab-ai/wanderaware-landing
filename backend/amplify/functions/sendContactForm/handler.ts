import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { env } from '$amplify/env/sendContactForm';

const sesClient = new SESClient({});

interface ContactFormEvent {
    arguments: {
        name: string;
        email: string;
        message: string;
    };
}

/** Strip CR/LF to prevent MIME header injection */
function sanitizeHeader(value: string): string {
    return value.replace(/[\r\n]/g, '');
}

function buildMimeEmail(params: {
    from: string;
    to: string[];
    replyTo: string;
    subject: string;
    body: string;
}): string {
    let email = '';
    email += `From: ${sanitizeHeader(params.from)}\r\n`;
    email += `To: ${params.to.map(sanitizeHeader).join(', ')}\r\n`;
    email += `Reply-To: ${sanitizeHeader(params.replyTo)}\r\n`;
    email += `Subject: ${sanitizeHeader(params.subject)}\r\n`;
    email += `MIME-Version: 1.0\r\n`;
    email += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
    email += params.body;
    return email;
}

export const handler = async (event: ContactFormEvent) => {
    const { name, email, message } = event.arguments;

    if (name.length > 200) {
        return { success: false, message: 'Name must be 200 characters or less' };
    }
    if (message.length > 5000) {
        return { success: false, message: 'Message must be 5000 characters or less' };
    }

    const isDev = env.SENDER_EMAIL.includes('dev.wanderaware.com');
    const subject = isDev
        ? `[DEV] New Contact Form Submission from ${name}`
        : `New Contact Form Submission from ${name}`;

    const body = `
New contact form submission received!

From: ${name}
Email: ${email}

Message:
${message}

---
This is an automated message from WanderAware Contact Form.
    `.trim();

    const recipients = env.RECIPIENT_EMAILS.split(',').map((e: string) => e.trim());
    const configurationSetName = env.SES_CONFIGURATION_SET_NAME || undefined;

    try {
        const mimeEmail = buildMimeEmail({
            from: env.SENDER_EMAIL,
            to: recipients,
            replyTo: email,
            subject,
            body
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

        return { success: true, message: 'Contact form submitted successfully' };
    } catch (error: unknown) {
        console.error('Failed to send contact form email:', error);
        const contactEmail = env.CONTACT_EMAIL || 'support@wanderaware.com';
        return {
            success: false,
            message: `Unable to send message automatically. Please email us directly at ${contactEmail}`
        };
    }
};
