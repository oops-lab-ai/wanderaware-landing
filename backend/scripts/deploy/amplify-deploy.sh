#!/usr/bin/env bash
#
# Probe + conditional deploy for Amplify Hosting.
#
# Called from amplify.yml backend.build. Deploys the backend when either:
#   (a) no backend stack exists yet for this branch
#   (b) the latest commit touched anything under backend/
#
# This keeps frontend-only commits fast while still making first branch deploys safe.
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

cd "$REPO_ROOT"
git fetch --depth=2 origin "$AWS_BRANCH" 2>/dev/null || true
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "backend/")

cd "$BACKEND_DIR"

BACKEND_EXISTS=true
npx ampx generate outputs --branch "$AWS_BRANCH" --app-id "$AWS_APP_ID" --out-dir /tmp/_wanderaware_probe --outputs-version 1 >/dev/null 2>&1 || BACKEND_EXISTS=false

if [ "$BACKEND_EXISTS" = "false" ]; then
  echo "No existing WanderAware backend for branch $AWS_BRANCH; deploying"
  npx ampx pipeline-deploy --branch "$AWS_BRANCH" --app-id "$AWS_APP_ID" --outputs-out-dir ../shared --outputs-version 1
elif echo "$CHANGED" | grep -q '^backend/'; then
  echo "Backend files changed; deploying"
  npx ampx pipeline-deploy --branch "$AWS_BRANCH" --app-id "$AWS_APP_ID" --outputs-out-dir ../shared --outputs-version 1
else
  echo "Backend stack exists and no backend changes; skipping deploy"
fi
