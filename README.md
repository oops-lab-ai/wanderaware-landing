# WanderAware

WanderAware is a monorepo for the public marketing site, authenticated dashboard, Amplify backend, and RFID reader firmware.

## Structure

- `frontend/` - Astro public landing page and React dashboard under `/dashboard`
- `backend/` - Amplify Gen 2 backend with Cognito, AppSync/Data, DynamoDB models, SES invitations, admin flows, and Stripe billing
- `firmware/` - PlatformIO firmware for RFID reader hardware
- `shared/amplify_outputs.json` - local/generated Amplify outputs consumed by the frontend

## Development

Install dependencies:

```powershell
npm install
cd frontend; npm install
cd ..\backend; npm install
```

Run the frontend:

```powershell
npm run dev
```

Run checks:

```powershell
npm run check
npm run check:frontend
npm run check:backend
```

Build firmware when PlatformIO is installed:

```powershell
npm run firmware:build
```

## Product Model

WanderAware is building-first: each billable building account has its own Stripe plan, device capacity, team members, RFID door readers, RFID tags, participants, and alerts. The backend still uses some `Organization` names internally for inherited auth/team/billing plumbing, but product-facing flows treat that record as the active building. Real IoT ingestion is intentionally out of scope for this migration; the dashboard models and placeholder screens are ready for that integration.
