# WanderAware Backend

Amplify Gen 2 backend for WanderAware.

Includes Cognito auth, AppSync/Data models, DynamoDB persistence, SES invitation/contact email, building/team flows, admin tools, and Stripe-backed plan/device-capacity billing.

Primary product models include billable building accounts, memberships, RFID door readers, RFID tags, participants, and alerts. The inherited internal `Organization` model is the building account until the remaining function names are renamed. Device-reader ingestion is not implemented in this migration.
