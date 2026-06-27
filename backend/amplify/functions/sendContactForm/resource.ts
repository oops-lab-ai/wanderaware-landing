import { defineFunction } from '@aws-amplify/backend';
import { EMAIL_CONSTANTS } from '../../custom/shared/emailConstants';

export const sendContactForm = defineFunction({
    entry: 'handler.ts',
    name: 'sendContactForm',
    resourceGroupName: 'data',
    environment: {
        RECIPIENT_EMAILS: EMAIL_CONSTANTS.DEV_RECIPIENTS,
        SENDER_EMAIL: EMAIL_CONSTANTS.DEFAULT_SENDER,
        CONTACT_EMAIL: EMAIL_CONSTANTS.CONTACT_EMAIL,
        SES_CONFIGURATION_SET_NAME: ''
    },
    timeoutSeconds: 15
});
