/**
 * Module-level pub/sub for the active organization id.
 *
 * Why not React Query: we tried `useQuery({ queryKey: ["activeOrgId"], staleTime: Infinity, initialData })`
 * and hit subtle bugs where `setQueryData` updates didn't reliably propagate to dependent
 * `useMemo` calls across components mounted in different parts of the tree (AuthGuard, sidebar
 * org switcher, page content). Switching to a plain module-level Set<callback> pub/sub fixed
 * the issues completely.
 *
 * This file is the single source of truth for "which org is the user looking at right now."
 * It's NOT auth state — that lives in useAuth (React Query, key ["auth"]). It IS pure client
 * state, derived from localStorage on first load and updated synchronously on switch.
 *
 * Per-user persistence: care center webs are shared. If user A picks org X and signs out, user B
 * should NOT inherit org X — they should start fresh in their own org. localStorage stores a
 * JSON map { [userId]: orgId } instead of a single value. The legacy single-key entry from
 * the pre-multi-user version is dropped on first load (treated as "no preference").
 *
 * Usage from React: prefer the useActiveOrgId hook (which wraps useSyncExternalStore).
 * Usage from outside React (e.g., signOut handler clearing on logout): import getActiveOrgId
 * / setActiveOrgId / clearActiveOrgForUser directly.
 */

const ACTIVE_ORG_KEY = "wanderaware_active_org";

type OrgIdMap = Record<string, string>;

function readMap(): OrgIdMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(ACTIVE_ORG_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Legacy migration: pre-multi-user storage was a single string (the org id),
    // not a JSON object. Dropping it is safe — first load picks the user's first
    // org by default in deriveSession, so no information is lost.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OrgIdMap;
    }
    return {};
  } catch {
    // Same migration path — parse failure means it's the legacy single-string value.
    return {};
  }
}

function writeMap(map: OrgIdMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_ORG_KEY, JSON.stringify(map));
}

const map: OrgIdMap = readMap();

// Active user id — set by AuthGuard once auth resolves. Until set, subscribers
// see null. This is intentional: pre-auth, no org is "active" because no user is.
let activeUserId: string | null = null;
let currentId: string | null = null;

const subscribers = new Set<() => void>();

function notify(): void {
  // Snapshot before iterating so an unsubscribe during fire is safe.
  for (const cb of Array.from(subscribers)) {
    cb();
  }
}

export function getActiveOrgId(): string | null {
  return currentId;
}

/**
 * Tell the pub/sub which user is signed in. Called once by AuthGuard after auth
 * resolves, and re-called on user changes (sign-in-as-different-user without a
 * full reload). Setting the active user looks up that user's stored org pick and
 * pushes it to all subscribers in the same React batch.
 */
export function setActiveUser(userId: string | null): void {
  if (userId === activeUserId) return;
  activeUserId = userId;
  const next = userId ? (map[userId] ?? null) : null;
  if (next !== currentId) {
    currentId = next;
  }
  notify();
}

export function setActiveOrgId(id: string | null): void {
  if (id === currentId) return;
  currentId = id;
  if (activeUserId) {
    if (id === null) {
      delete map[activeUserId];
    } else {
      map[activeUserId] = id;
    }
    writeMap(map);
  }
  notify();
}

/**
 * Clear ONLY the current user's saved org pick. Called by the sign-out handler.
 * Other users' picks are preserved so a shared care center web doesn't leak one
 * user's last org to the next.
 */
export function clearActiveOrgForUser(userId: string): void {
  if (userId in map) {
    delete map[userId];
    writeMap(map);
  }
  if (userId === activeUserId) {
    activeUserId = null;
    currentId = null;
    notify();
  }
}

export function subscribeActiveOrgId(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
