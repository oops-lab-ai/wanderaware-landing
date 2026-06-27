# WanderAware

WanderAware is an Amplify-ready Astro + React web app for adult day care teams that need building, RFID reader, tag, participant, alert, team, and billing management.

## Structure

- `frontend/` - Astro public landing page and React dashboard under `/dashboard`
- `backend/` - Amplify Gen 2 backend with Cognito, AppSync/Data, DynamoDB models, SES invitations, admin flows, and Stripe billing
- `shared/amplify_outputs.json` - local/generated Amplify outputs consumed by the frontend

## Development

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
npm run check:frontend
npm run check:backend
```

IoT reader ingestion is intentionally out of scope for this migration. The dashboard has data-ready building, reader, tag, participant, and alert surfaces that can be connected to ingestion later.