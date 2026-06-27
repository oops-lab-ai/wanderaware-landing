import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventbridge from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
// import * as logs from 'aws-cdk-lib/aws-logs';
import { type backend } from '../../backend';

interface StripeWebhooksProps {
    backend: typeof backend;
}

export class StripeWebhooksStack extends Construct {
    constructor(scope: Construct, id: string, props: StripeWebhooksProps) {
        super(scope, id);

        /**
         * Using STRIPE_PARTNER_ID from environment variable instead of SSM parameter
         */
        const stripePartnerId = process.env.STRIPE_PARTNER_ID;

        if (!stripePartnerId) {
            throw new Error('STRIPE_PARTNER_ID environment variable is required');
        }

        // Use default bus or import custom if you have one
        const bus = eventbridge.EventBus.fromEventBusName(this, `StripePartnerBus-${id}`, `aws.partner/stripe.com/${stripePartnerId}`);

        // Dead-letter queue for failed Stripe event processing
        const stripeDlq = new sqs.Queue(this, 'StripeDLQ', {
            queueName: `wanderaware-${id}-stripe-events-dlq`,
            retentionPeriod: Duration.days(14),
            removalPolicy: RemovalPolicy.DESTROY,
        });

        // Create SQS with removal policy and DLQ
        const stripeEventsQueue = new sqs.Queue(this, 'StripeEventsQueue', {
            queueName: `wanderaware-${id}-stripe-events-queue`,
            retentionPeriod: Duration.days(4),
            removalPolicy: RemovalPolicy.DESTROY,
            deadLetterQueue: {
                queue: stripeDlq,
                maxReceiveCount: 3, // Move to DLQ after 3 failed processing attempts
            },
        });

        // Rule to match partner events - subscription and invoice events
        const stripePartnerRule = new eventbridge.Rule(this, `wanderaware-${id}-StripePartnerRule`, {
            eventBus: bus,
            eventPattern: {
                source: [`aws.partner/stripe.com/${stripePartnerId}`],
                detailType: [
                    // Customer events
                    'customer.deleted',
                    // Subscription events
                    'customer.subscription.created',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'customer.subscription.trial_will_end',
                    // Invoice events (critical for renewals)
                    'invoice.paid',
                    'invoice.payment_failed',
                    // Checkout events
                    'checkout.session.completed',
                ],
            },
        });

        // // Create log group with removal policy
        // const logGroup = new logs.LogGroup(this, `wanderaware-${id}-StripeEventLogGroup`, {
        //     logGroupName: `/aws/events/wanderaware-${id}-stripe-events`,
        //     retention: logs.RetentionDays.ONE_WEEK,
        //     removalPolicy: RemovalPolicy.DESTROY,
        // });

        // stripePartnerRule.addTarget(new targets.CloudWatchLogGroup(logGroup));

        stripePartnerRule.addTarget(new targets.SqsQueue(stripeEventsQueue));

        // Get the payment processor Lambda function
        const paymentProcessorLambda = props.backend.paymentProcessor.resources.lambda;

        // Attach SQS as an event source so Lambda polls messages
        paymentProcessorLambda.addEventSource(
            new SqsEventSource(stripeEventsQueue, {
                batchSize: 5,
                reportBatchItemFailures: true,
            }),
        );
    }
}
