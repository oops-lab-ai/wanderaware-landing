import { defineFunction } from '@aws-amplify/backend';
import { EMAIL_CONSTANTS } from '../../custom/shared/emailConstants';

export const sendEmail = defineFunction({
    entry: 'handler.ts',
    name: 'sendEmail',
    resourceGroupName: 'data',
    environment: {
        // Comma-separated list of default recipient emails
        // Default to safe email for dev/sandbox to avoid verification errors
        RECIPIENT_EMAILS: EMAIL_CONSTANTS.DEV_RECIPIENTS,
        // Default sender - can be overridden by backend.ts or event
        SENDER_EMAIL: EMAIL_CONSTANTS.DEFAULT_SENDER,
        // Contact email for error messages
        CONTACT_EMAIL: EMAIL_CONSTANTS.CONTACT_EMAIL,
        // Configuration set name for SES event tracking - set dynamically in backend.ts
        SES_CONFIGURATION_SET_NAME: ''
    },
    timeoutSeconds: 15 // Increased to allow for suppression list check
});
