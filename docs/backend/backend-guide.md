# Backend Guide

The backend uses Amplify Gen 2 with Cognito, AppSync/Data, DynamoDB, Lambda functions, SES invitations, and Stripe billing.

## Local Commands

```powershell
npm run sandbox:start
npm run sandbox:delete
npm run check:backend
```

Both sandbox scripts must use AWS profile `admin-amplify-oops-1`.

## Billing Model

User-facing language is plan/device capacity. Internal legacy fields such as `seatsUsed` may remain temporarily where inherited API contracts still use them, but visible UI and messages should say device slots or capacity.

## Deployment Notes

`backend/scripts/deploy/amplify-deploy.sh` is called from `amplify.yml` during Amplify Hosting builds. It deploys the backend on first branch deploys or when files under `backend/` changed.
