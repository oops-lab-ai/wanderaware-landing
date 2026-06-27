# Stripe → EventBridge Integration (Partner Source)

This setup lets **Stripe** send events **directly** into **AWS EventBridge** via a partner integration. We then buffer those events in **SQS** and consume them with a **Lambda** function—no manual webhook endpoint or signature verification required.

## Overview

1. **Stripe Event Destination**
    - Created in the Stripe Dashboard (Workbench → Event destinations).
    - Stripe generates a **partner event source** (for example, `aws.partner/stripe.com/<UNIQUE_ID>`).

2. **Associate Partner Source**
    - In AWS EventBridge → Partner event sources, associate the new source with an EventBridge bus.

3. **EventBridge**
    - A rule filters incoming Stripe events (e.g., `checkout.session.completed`) and routes them to an SQS queue.

4. **SQS**
    - Buffers messages to handle traffic spikes or retries.

5. **Lambda Consumer**
    - Consumes messages from the queue, implementing your payment or subscription logic.

## Setup Steps

1. **Enable Event Destinations in Stripe**
    - In **Stripe Dashboard** → **Developers** → **Workbench** → **Event destinations**.
    - **Create new destination**, select **Amazon EventBridge**, and provide AWS account + region.
    - Choose relevant event types (e.g., `checkout.session.completed`).

2. **Associate the Partner Source in AWS**
    - Go to **AWS Console** → **Amazon EventBridge** → **Partner event sources**.
    - Find the **pending** Stripe source and **Associate** it with your bus (default or custom).

3. **Store Partner ID in SSM**
    - Stripe displays a unique ID after `aws.partner/stripe.com/`.
    - Save it in **AWS SSM Parameter Store**:
        ```bash
        aws ssm put-parameter --name "stripe-event-prod-id" \
          --value "VALUE" \
          --type "String" --overwrite --profile admin-amplify
        ```

4. **Deploy the Stack**
    - Reference the SSM parameter and create an EventBridge rule matching `aws.partner/stripe.com/<YOUR_PARTNER_ID>`.
    - Route those events to an **SQS queue**.
    - Attach the queue to your **Lambda** (like `payment-processor`) to handle messages.

5. **Test**
    - In Stripe Workbench, trigger an event (e.g. `checkout.session.completed`).
    - Check CloudWatch logs for the Lambda to confirm message processing.
    - Monitor EventBridge and SQS metrics.

## Advantages Over Webhooks

- **No Public Endpoint**: You don’t need an API Gateway or a dedicated “webhook” Lambda.
- **No Signature Verification**: Stripe handles reliable delivery directly to AWS.
- **Scalability**: SQS + Lambda easily handle high volumes.

## Maintenance Notes

- **One-time Partner Source Association**: Must be done in AWS Console within 7 days of creating the Stripe destination.
- **Parameter Updates**: If your partner ID changes, update the SSM parameter.
- **Decommission**: Disable or delete the event destination in Stripe, then disassociate or remove the partner source in AWS EventBridge.

## Troubleshooting

- **Events Not Appearing**: Ensure you associated the partner source with the correct EventBridge bus.
- **Missing Parameter**: Confirm you stored `stripe-event-prod-id` in SSM.
- **Lambda Errors**: Check CloudWatch logs and SQS DLQ (if configured).
