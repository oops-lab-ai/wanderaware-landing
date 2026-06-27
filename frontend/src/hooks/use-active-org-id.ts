import { useSyncExternalStore } from "react";

import { getActiveOrgId, setActiveOrgId, subscribeActiveOrgId } from "@/lib/active-org-id";

/**
 * Subscribe a React component to the module-level active org id.
 *
 * Returns a tuple [activeOrgId, setActiveOrgId] mirroring useState. setActiveOrgId
 * is the same module-level setter every consumer of this hook receives — calling it
 * synchronously notifies every other useSyncExternalStore subscriber, so all
 * components watching the active org re-render in the same React batch.
 *
 * Server-snapshot returns null because there's no concept of "the active org" outside
 * the browser; localStorage is unavailable.
 */
export function useActiveOrgId(): readonly [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(subscribeActiveOrgId, getActiveOrgId, () => null);
  return [id, setActiveOrgId] as const;
}
