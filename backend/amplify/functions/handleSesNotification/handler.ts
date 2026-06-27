import { SNSEvent, SNSEventRecord } from 'aws-lambda';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '../../data/resource';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/handleSesNotification';
import { Amplify } from 'aws-amplify';

// Initialize Amplify client
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

// SES Notification Types
interface SESBounceNotification {
    notificationType: 'Bounce';
    bounce: {
        bounceType: 'Permanent' | 'Transient' | 'Undetermined';
        bounceSubType: string;
        bouncedRecipients: Array<{
            emailAddress: string;
            action?: string;
            status?: string;
            diagnosticCode?: string;
        }>;
        timestamp: string;
        feedbackId: string;
        remoteMtaIp?: string;
        reportingMTA?: string;
    };
    mail: SESMailObject;
}

interface SESComplaintNotification {
    notificationType: 'Complaint';
    complaint: {
        complainedRecipients: Array<{
            emailAddress: string;
        }>;
        timestamp: string;
        feedbackId: string;
        complaintSubType?: string;
        complaintFeedbackType?: 'abuse' | 'auth-failure' | 'fraud' | 'not-spam' | 'other' | 'virus';
        userAgent?: string;
        arrivalDate?: string;
    };
    mail: SESMailObject;
}

interface SESDeliveryNotification {
    notificationType: 'Delivery';
    delivery: {
        timestamp: string;
        processingTimeMillis: number;
        recipients: string[];
        smtpResponse: string;
        remoteMtaIp: string;
        reportingMTA: string;
    };
    mail: SESMailObject;
}

interface SESMailObject {
    timestamp: string;
    source: string;
    sourceArn: string;
    sourceIp: string;
    sendingAccountId: string;
    messageId: string;
    destination: string[];
    headersTruncated: boolean;
    headers: Array<{ name: string; value: string }>;
    commonHeaders: {
        from: string[];
        to: string[];
        subject: string;
    };
}

type SESNotification = SESBounceNotification | SESComplaintNotification | SESDeliveryNotification;

/**
 * Add an email to the suppression list using Amplify Data client
 */
async function addToSuppressionList(params: {
    email: string;
    reason: 'hard_bounce' | 'complaint' | 'manual';
    bounceType?: string;
    bounceSubType?: string;
    complaintFeedbackType?: string;
    originalError?: string;
}): Promise<void> {
    const { email, reason, bounceType, bounceSubType, complaintFeedbackType, originalError } = params;

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if email already exists in suppression list
        const existing = await client.models.EmailSuppressionList.get({ email: normalizedEmail });

        if (existing.data) {
            console.log(`Email ${normalizedEmail} already in suppression list, updating...`);
            // Update existing record
            await client.models.EmailSuppressionList.update({
                email: normalizedEmail,
                reason,
                bounceType: bounceType || null,
                bounceSubType: bounceSubType || null,
                complaintFeedbackType: complaintFeedbackType || null,
                originalError: originalError || null,
                suppressedAt: new Date().toISOString()
            });
        } else {
            // Create new suppression record
            await client.models.EmailSuppressionList.create({
                email: normalizedEmail,
                reason,
                bounceType: bounceType || null,
                bounceSubType: bounceSubType || null,
                complaintFeedbackType: complaintFeedbackType || null,
                originalError: originalError || null,
                suppressedAt: new Date().toISOString(),
                expiresAt: null // Permanent suppression by default
            });
        }

        console.log(`Added ${normalizedEmail} to suppression list. Reason: ${reason}`);
    } catch (error) {
        console.error(`Failed to add ${normalizedEmail} to suppression list:`, error);
        throw error;
    }
}

/**
 * Process a bounce notification from SES
 */
async function processBounce(notification: SESBounceNotification): Promise<void> {
    const { bounce, mail } = notification;

    console.log('Processing bounce notification:', {
        bounceType: bounce.bounceType,
        bounceSubType: bounce.bounceSubType,
        feedbackId: bounce.feedbackId,
        messageId: mail.messageId,
        recipientCount: bounce.bouncedRecipients.length
    });

    // Only suppress for permanent (hard) bounces
    // Transient bounces are temporary and SES handles retries
    if (bounce.bounceType === 'Permanent') {
        for (const recipient of bounce.bouncedRecipients) {
            await addToSuppressionList({
                email: recipient.emailAddress,
                reason: 'hard_bounce',
                bounceType: bounce.bounceType,
                bounceSubType: bounce.bounceSubType,
                originalError: recipient.diagnosticCode || `${bounce.bounceSubType}: ${recipient.status || 'Unknown'}`
            });
        }
    } else {
        // Log transient bounces for monitoring but don't suppress
        console.log('Transient bounce - not suppressing:', {
            bounceType: bounce.bounceType,
            bounceSubType: bounce.bounceSubType,
            recipients: bounce.bouncedRecipients.map((r) => r.emailAddress)
        });
    }
}

/**
 * Process a complaint notification from SES
 */
async function processComplaint(notification: SESComplaintNotification): Promise<void> {
    const { complaint, mail } = notification;

    console.log('Processing complaint notification:', {
        complaintFeedbackType: complaint.complaintFeedbackType,
        feedbackId: complaint.feedbackId,
        messageId: mail.messageId,
        recipientCount: complaint.complainedRecipients.length
    });

    // Always suppress for complaints - user marked email as spam
    // Exception: 'not-spam' feedback type means user un-marked as spam
    if (complaint.complaintFeedbackType === 'not-spam') {
        console.log('Received not-spam feedback - consider removing from suppression list:', {
            recipients: complaint.complainedRecipients.map((r) => r.emailAddress)
        });
        // Note: We don't automatically remove from suppression list
        // This should be a manual review process
        return;
    }

    for (const recipient of complaint.complainedRecipients) {
        await addToSuppressionList({
            email: recipient.emailAddress,
            reason: 'complaint',
            complaintFeedbackType: complaint.complaintFeedbackType,
            originalError: `Complaint: ${complaint.complaintFeedbackType || 'Unknown'}`
        });
    }
}

/**
 * Process a delivery notification from SES (for logging/monitoring)
 */
function processDelivery(notification: SESDeliveryNotification): void {
    const { delivery, mail } = notification;

    console.log('Email delivered successfully:', {
        messageId: mail.messageId,
        recipients: delivery.recipients,
        processingTimeMs: delivery.processingTimeMillis,
        smtpResponse: delivery.smtpResponse
    });
}

/**
 * Process a single SNS record containing an SES notification
 */
async function processSnsRecord(record: SNSEventRecord): Promise<void> {
    try {
        const message = JSON.parse(record.Sns.Message) as SESNotification;

        console.log('Received SES notification:', {
            notificationType: message.notificationType,
            messageId: message.mail?.messageId,
            timestamp: record.Sns.Timestamp
        });

        switch (message.notificationType) {
            case 'Bounce':
                await processBounce(message);
                break;
            case 'Complaint':
                await processComplaint(message);
                break;
            case 'Delivery':
                processDelivery(message);
                break;
            default:
                console.warn('Unknown notification type:', (message as any).notificationType);
        }
    } catch (error) {
        console.error('Failed to process SNS record:', error);
        console.error('Raw message:', record.Sns.Message);
        throw error;
    }
}

/**
 * Lambda handler for SES bounce/complaint notifications via SNS
 */
export const handler = async (event: SNSEvent): Promise<void> => {
    console.log('Received SNS event with', event.Records.length, 'records');

    const errors: Error[] = [];

    for (const record of event.Records) {
        try {
            await processSnsRecord(record);
        } catch (error) {
            errors.push(error as Error);
            // Continue processing other records even if one fails
        }
    }

    if (errors.length > 0) {
        console.error(`Failed to process ${errors.length} of ${event.Records.length} records`);
        // Throw to trigger Lambda retry for failed records
        throw new Error(`Failed to process ${errors.length} records: ${errors.map((e) => e.message).join(', ')}`);
    }

    console.log('Successfully processed all', event.Records.length, 'records');
};
