# System Overview

WanderAware is a monorepo with four active areas:

- `frontend/`: Astro marketing page and React dashboard under `/dashboard`.
- `backend/`: Amplify Gen 2 backend for auth, data, invitations, admin workflows, and Stripe billing.
- `firmware/`: PlatformIO firmware for RFID reader hardware.
- `shared/`: generated Amplify outputs consumed by the frontend.

The v1 app supports customer validation and dashboard readiness. Real IoT ingestion is intentionally deferred; dashboard models and placeholder workflows are present so ingestion can be added without redesigning the app.

## Primary Flows

- Public visitors land on `/`, join the waitlist, reserve interest, or click outreach links tracked by PostHog.
- Owners sign up, create an organization, invite team members, and manage plan/device capacity.
- Organizations manage buildings, readers, tags, participants, and alerts.
- Admins manage organizations, users, plan grants, and capacity exceptions.
