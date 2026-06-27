/**
 * Defense-in-depth runtime check for admin Lambdas.
 *
 * The PRIMARY auth gate is at the schema level via `.authorization((allow) => [allow.groups(['admins'])])`,
 * which causes AppSync to reject non-admin requests before the Lambda runs at all. This helper
 * is the second layer — call it as the first line of every admin Lambda so even if someone
 * misconfigures the schema, the Lambda still rejects.
 *
 * The `admins` Cognito group is populated by postAuthentication on every sign-in, reading
 * the ADMIN_EMAILS env var. See backend/amplify/functions/postAuthentication/handler.ts.
 */

interface AppSyncIdentityWithGroups {
    sub?: string;
    groups?: string[];
    cognitoGroups?: string[];
    claims?: { 'cognito:groups'?: string | string[] };
}

export function isAdmin(event: { identity?: unknown }): boolean {
    const identity = event.identity as AppSyncIdentityWithGroups | undefined;
    if (!identity) return false;

    const groups: string[] =
        identity.groups ??
        identity.cognitoGroups ??
        (typeof identity.claims?.['cognito:groups'] === 'string'
            ? (identity.claims['cognito:groups'] as string).split(',').map((s) => s.trim())
            : (identity.claims?.['cognito:groups'] as string[] | undefined) ?? []);

    return Array.isArray(groups) && groups.includes('admins');
}

export function requireAdmin(event: { identity?: unknown }): string {
    const identity = event.identity as AppSyncIdentityWithGroups | undefined;
    const userId = identity?.sub;
    if (!userId) throw new Error('Unauthorized');
    if (!isAdmin(event)) throw new Error('Admin access required');
    return userId;
}
