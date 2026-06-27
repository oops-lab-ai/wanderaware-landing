# Amplify Sandbox Runbook

Use the Oops Lab Amplify profile for local sandbox work:

```powershell
aws sts get-caller-identity --profile admin-amplify-oops-1
npm run sandbox:start
```

Delete a sandbox only when explicitly intended:

```powershell
npm run sandbox:delete
```

## Expected Outputs

Sandbox deploy writes Amplify outputs into `shared/amplify_outputs.json`. The frontend reads those outputs through `frontend/src/lib/amplify/auth-client.ts` and `frontend/src/lib/amplify/data-client.ts`.

## Secrets

Set required secrets with:

```powershell
cd backend
npx ampx sandbox --profile admin-amplify-oops-1 secret set STRIPE_SECRET_KEY
```

Add OAuth and email secrets as those features move from scaffolded to active.
