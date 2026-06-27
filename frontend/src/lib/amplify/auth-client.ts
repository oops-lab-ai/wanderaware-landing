import { Amplify } from "aws-amplify";
import { signInWithRedirect } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

import outputs from "../../../../shared/amplify_outputs.json";

type AuthOutputs = {
  user_pool_id?: string;
  user_pool_client_id?: string;
  identity_pool_id?: string;
};

if (typeof window !== "undefined") {
  (window as unknown as { __amplifyOAuthBundlePin?: unknown }).__amplifyOAuthBundlePin = signInWithRedirect;
}

function getAuthOutputs() {
  return ((outputs as { auth?: AuthOutputs }).auth ?? {}) as AuthOutputs;
}

export function hasAmplifyAuthConfig() {
  const auth = getAuthOutputs();
  return Boolean(auth.user_pool_id && auth.user_pool_client_id && auth.identity_pool_id);
}

if (hasAmplifyAuthConfig()) {
  Amplify.configure(outputs);
}

if (typeof window !== "undefined") {
  Hub.listen("auth", ({ payload }) => {
    if (payload.event === "signInWithRedirect_failure") {
      console.error("[auth] signInWithRedirect failed:", payload.data);
    }
  });
}

export function getCognitoDomain(): string {
  return (outputs as { auth?: { oauth?: { domain?: string } } }).auth?.oauth?.domain ?? "";
}

export async function awaitOAuthCallbackIfPresent(timeoutMs = 8000): Promise<void> {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code") || !params.has("state")) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve();
    }, timeoutMs);
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect" || payload.event === "signInWithRedirect_failure") {
        clearTimeout(timer);
        stop();
        resolve();
      }
    });
  });
}

export function getRefreshToken(): string {
  const clientId = getAuthOutputs().user_pool_client_id ?? "";
  const prefix = `CognitoIdentityServiceProvider.${clientId}`;
  const lastAuthUser = localStorage.getItem(`${prefix}.LastAuthUser`) ?? "";
  if (!lastAuthUser) return "";
  return localStorage.getItem(`${prefix}.${lastAuthUser}.refreshToken`) ?? "";
}
