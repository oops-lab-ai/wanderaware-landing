import { Construct } from 'constructs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';

interface SesDomainConfig {
    domain: string;
    mailFromSubdomain: string;
}

interface SesEmailModuleProps {
    hostedZoneId: string;
    domains: SesDomainConfig[];
    /**
     * Optional: Lambda function to handle bounce/complaint notifications
     * If provided, SNS topics will be created and subscribed to this Lambda
     */
    notificationHandler?: lambda.IFunction;
}

/**
 * AWS SES Email Module
 *
 * Registers DNS intents for SES and creates the SES Email Identity for multiple domains.
 *
 * Using publicHostedZone() automatically creates:
 * - DKIM CNAME records (3 records for Easy DKIM)
 * - Domain verification (automatic via DKIM)
 * - MAIL FROM subdomain MX and SPF (for mail.domain.com, NOT root domain)
 *
 * When notificationHandler is provided:
 * - Creates SNS topics for bounces and complaints
 * - Configures SES to send notifications to these topics
 * - Subscribes the Lambda function to process notifications
 */
export class SesEmailModule extends Construct {
    public readonly identities: ses.EmailIdentity[] = [];
    public readonly bounceTopic?: sns.Topic;
    public readonly complaintTopic?: sns.Topic;

    constructor(scope: Construct, id: string, props: SesEmailModuleProps) {
        super(scope, id);

        const { hostedZoneId, domains, notificationHandler } = props;

        // Create SNS topics for bounce/complaint notifications if handler is provided
        if (notificationHandler) {
            // Create bounce topic with explicit name for consistent resource identification
            this.bounceTopic = new sns.Topic(this, 'SesBouncesTopic', {
                topicName: `ses-bounces-${id}`,
                displayName: 'SES Bounce Notifications'
            });

            // Create complaint topic with explicit name for consistent resource identification
            this.complaintTopic = new sns.Topic(this, 'SesComplaintsTopic', {
                topicName: `ses-complaints-${id}`,
                displayName: 'SES Complaint Notifications'
            });

            // Subscribe Lambda to both topics
            this.bounceTopic.addSubscription(new snsSubscriptions.LambdaSubscription(notificationHandler));

            this.complaintTopic.addSubscription(new snsSubscriptions.LambdaSubscription(notificationHandler));

            // Grant SNS permission to invoke the Lambda
            notificationHandler.addPermission('AllowSNSBounceInvoke', {
                principal: new iam.ServicePrincipal('sns.amazonaws.com'),
                sourceArn: this.bounceTopic.topicArn
            });

            notificationHandler.addPermission('AllowSNSComplaintInvoke', {
                principal: new iam.ServicePrincipal('sns.amazonaws.com'),
                sourceArn: this.complaintTopic.topicArn
            });
        }

        domains.forEach(({ domain, mailFromSubdomain }) => {
            // Create a zone reference for this specific domain/subdomain
            // forcing the zoneName to match the domain we want to verify
            // while pointing to the correct physical Hosted Zone ID.
            const zone = route53.PublicHostedZone.fromHostedZoneAttributes(this, `Zone-${domain}`, {
                hostedZoneId,
                zoneName: domain
            });

            // Build configuration set actions if notification handler is provided
            // Use explicit configurationSetName for consistent resource identification
            const configurationSetEventDestination = notificationHandler
                ? new ses.ConfigurationSet(this, `ConfigSet-${domain}`, {
                      configurationSetName: `ses-config-${domain.replace(/\./g, '-')}`
                  })
                : undefined;

            const identity = new ses.EmailIdentity(this, `Identity-${domain}`, {
                identity: ses.Identity.publicHostedZone(zone),
                mailFromDomain: `${mailFromSubdomain}.${domain}`,
                configurationSet: configurationSetEventDestination
            });

            // Configure bounce and complaint notifications via SNS
            if (this.bounceTopic && this.complaintTopic) {
                // Use CfnConfigurationSetEventDestination to add SNS destinations
                new ses.CfnConfigurationSetEventDestination(this, `BounceEventDest-${domain}`, {
                    configurationSetName: configurationSetEventDestination!.configurationSetName,
                    eventDestination: {
                        name: `bounce-notifications-${domain.replace(/\./g, '-')}`,
                        enabled: true,
                        matchingEventTypes: ['bounce'],
                        snsDestination: {
                            topicArn: this.bounceTopic.topicArn
                        }
                    }
                });

                new ses.CfnConfigurationSetEventDestination(this, `ComplaintEventDest-${domain}`, {
                    configurationSetName: configurationSetEventDestination!.configurationSetName,
                    eventDestination: {
                        name: `complaint-notifications-${domain.replace(/\./g, '-')}`,
                        enabled: true,
                        matchingEventTypes: ['complaint'],
                        snsDestination: {
                            topicArn: this.complaintTopic.topicArn
                        }
                    }
                });
            }

            this.identities.push(identity);
        });
    }

    grantSendEmail(grantee: iam.IGrantable) {
        this.identities.forEach((identity) => {
            identity.grantSendEmail(grantee);
        });
    }

    /**
     * Get the configuration set name for use in SendEmail calls
     * Required when using event destinations for bounce/complaint tracking
     * Returns the explicit name pattern used when creating the configuration set
     */
    getConfigurationSetName(domain: string): string {
        return `ses-config-${domain.replace(/\./g, '-')}`;
    }
}
