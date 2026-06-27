# WanderAware Docs

This folder is the operating manual for the WanderAware monorepo. Keep product decisions, backend deployment notes, frontend patterns, firmware notes, testing runbooks, and analytics conventions here instead of scattering them through chat threads or local notes.

## Folder Map

- `architecture/` - system boundaries, data model, and cross-app flows
- `product/` - product scope, validation assumptions, positioning, and roadmap notes
- `frontend/` - Astro marketing site, React dashboard, UI/theme conventions
- `backend/` - Amplify Gen 2, Cognito, AppSync/Data, DynamoDB, SES, Stripe
- `firmware/` - PlatformIO reader firmware, hardware assumptions, serial/debug notes
- `deployment/` - Amplify sandbox/hosting, AWS profile, DNS, secrets, release steps
- `testing/` - local checks, browser smoke tests, sandbox validation, future E2E
- `analytics/` - PostHog, outreach attribution, funnel event naming
- `operations/` - support, incident triage, admin grants, customer onboarding

## Rules

- Prefer updating docs in the folder closest to the change.
- Keep `docs/INDEX.md` current when adding or renaming documents.
- Use `admin-amplify-oops-1` for local Amplify sandbox work unless a document explicitly says otherwise.
- Keep medical details out of v1 participant docs and schemas; document operational risk/status only.
