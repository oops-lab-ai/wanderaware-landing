import { useEffect, useState } from "react";

import { fetchAuthSession } from "aws-amplify/auth";

/**
 * Reads the `cognito:groups` claim from the current Amplify session and returns
 * `{ isAdmin, isChecking }`.
 *
 * Group membership is reconciled by the postAuthentication trigger on every sign-in
 * against the ADMIN_EMAILS env var. Frontend gating with this hook is **not** purely
 * cosmetic — it gates the admin UI shell so non-admins don't get a flash of "Search,
 * inspect, block, and delete users" copy before the GraphQL Unauthorized lands.
 * The AppSync schema gate (`allow.groups(['admins'])`) is still the real auth boundary
 * for data, so even a malicious user who flips this hook's return value can't actually
 * call admin Lambdas.
 *
 * `isChecking` distinguishes "still resolving the Cognito session" from "definitely
 * not an admin" so admin pages can show a skeleton instead of redirecting briefly.
 */
export function useIsAdmin(): { isAdmin: boolean; isChecking: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        const groups = session.tokens?.idToken?.payload?.["cognito:groups"];
        const groupArray = Array.isArray(groups) ? (groups as string[]) : typeof groups === "string" ? [groups] : [];
        setIsAdmin(groupArray.includes("admins"));
        setIsChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
        setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, isChecking };
}
