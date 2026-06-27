# Testing Guide

## Static Checks

Run from the repo root:

```powershell
npm run check
```

This runs:

- frontend Astro build
- frontend Biome check
- backend Amplify TypeScript compile

## Browser Smoke

After starting the frontend:

```powershell
npm run dev
```

Check:

- `/` loads the WanderAware landing page.
- `/dashboard/login` loads the login view.
- `/dashboard` redirects or gates appropriately when signed out.

## Sandbox Smoke

After `npm run sandbox:start`, confirm `shared/amplify_outputs.json` exists and contains real `auth` and `data` values.
