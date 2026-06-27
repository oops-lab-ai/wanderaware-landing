import { useEffect, useState } from "react";

import { Link, Navigate, useNavigate, useParams } from "react-router";

import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  Loader2,
  LogOut,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAdminDeleteUser,
  useAdminDisableUser,
  useAdminEnableUser,
  useAdminGetUser,
  useAdminGrantOrg,
  useAdminResetUserPassword,
  useAdminSearchUsers,
  useAdminSignOutUser,
} from "@/hooks/use-admin";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { AdminUserSearchItem } from "@/lib/amplify/data-client";

const USER_ROW_SKELETON_KEYS = ["user-row-1", "user-row-2", "user-row-3", "user-row-4", "user-row-5"];
const PLAN_OPTIONS = [
  { value: "free", label: "Free", defaultSeats: 1 },
  { value: "basic", label: "Basic", defaultSeats: 1 },
  { value: "professional", label: "Professional", defaultSeats: 5 },
  { value: "enterprise", label: "Enterprise", defaultSeats: 999999 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(enabled: boolean | null, userStatus: string | null) {
  if (enabled === false) {
    return <Badge variant="destructive">Blocked</Badge>;
  }
  if (userStatus === "FORCE_CHANGE_PASSWORD" || userStatus === "RESET_REQUIRED") {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Password reset</Badge>
    );
  }
  if (userStatus === "UNCONFIRMED") {
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Unconfirmed</Badge>;
  }
  if (enabled === true && userStatus === "CONFIRMED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>
    );
  }
  return <Badge variant="secondary">{userStatus ?? "Unknown"}</Badge>;
}

function defaultSeatsForPlan(planTier: string) {
  return PLAN_OPTIONS.find((option) => option.value === planTier)?.defaultSeats ?? 1;
}

// ── Page entry ──────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { userId } = useParams<{ userId?: string }>();
  const { isAdmin, isChecking } = useIsAdmin();

  // Frontend gate to prevent admin UI shell from flashing for non-admins. The
  // schema gate still rejects the actual queries; this just keeps the warning copy
  // ("blocked users fail their next sign-in attempt…") off non-admin screens.
  if (isChecking) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Single component handles both the list and the detail view. The URL param
  // decides which — /admin/users → list, /admin/users/:userId → detail. Keeps
  // the file count down and matches how the grants page co-locates related views.
  if (userId) {
    return <UserDetailView userId={userId} />;
  }
  return <UserListView />;
}

// ── List view ──────────────────────────────────────────────────────────────

function UserListView() {
  const [query, setQuery] = useState("");
  // 300ms debounce: only run the server-side search after the user pauses
  // typing. Keeps the admin table from thrashing while someone types an email.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useAdminSearchUsers(debounced);
  const users = data?.users ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <UsersIcon className="size-6" />
          Users
        </h1>
        <p className="text-muted-foreground text-sm">
          Search, inspect, block, and delete users. Actions here apply immediately — blocked users fail their next
          sign-in attempt, forced sign-outs invalidate all active sessions.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by email…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            Case-insensitive substring match. Leave blank to list the first 50 users.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {USER_ROW_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-10 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orgs</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: AdminUserSearchItem) => (
                  <TableRow key={u.userId}>
                    <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                    <TableCell>{statusBadge(u.enabled, u.userStatus)}</TableCell>
                    <TableCell>{u.orgCount}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/users/${u.userId}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Detail view ─────────────────────────────────────────────────────────────

function UserDetailView({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useAdminGetUser(userId);

  const disableUser = useAdminDisableUser();
  const enableUser = useAdminEnableUser();
  const signOutUser = useAdminSignOutUser();
  const resetPassword = useAdminResetUserPassword();
  const deleteUser = useAdminDeleteUser();
  const grantOrg = useAdminGrantOrg();

  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [grantPlan, setGrantPlan] = useState("free");
  const [grantDays, setGrantDays] = useState("");

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link to="/admin/users">
            <ArrowLeft className="size-4" />
            Back to users
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">User not found.</CardContent>
        </Card>
      </div>
    );
  }

  const user = data.user;
  const isDisabled = user.enabled === false;

  async function runAction(
    label: string,
    fn: () => Promise<{ success: boolean | null; message: string | null }>,
    opts: { redirectOnSuccess?: boolean } = {},
  ) {
    try {
      const res = await fn();
      if (res.success) {
        toast.success(res.message ?? `${label} succeeded`);
        if (opts.redirectOnSuccess) {
          navigate("/admin/users", { replace: true });
        }
      } else {
        toast.error(res.message ?? `${label} failed`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2 w-fit">
            <Link to="/admin/users">
              <ArrowLeft className="size-4" />
              Back to users
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <ShieldAlert className="size-6" />
            {user.email ?? user.userId}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.userId} · joined {formatDate(user.createdAt)}
          </p>
        </div>
        <div>{statusBadge(user.enabled, user.userStatus)}</div>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground text-xs">User ID</Label>
            <p className="break-all font-mono text-xs">{user.userId}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p>{user.email ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Cognito status</Label>
            <p>{user.userStatus ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Last modified</Label>
            <p>{formatDate(user.lastModifiedAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Organizations card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Organizations ({data.organizations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.organizations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No organizations.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Grant expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.organizations.map((o) => (
                  <TableRow key={o.membershipId ?? `${o.organizationId}-${o.role}`}>
                    <TableCell className="font-medium">{o.organizationName ?? "—"}</TableCell>
                    <TableCell className="capitalize">{o.role ?? "—"}</TableCell>
                    <TableCell>{o.planTier ?? "—"}</TableCell>
                    <TableCell>{formatDate(o.grantExpiresAt)}</TableCell>
                    <TableCell>
                      {o.deletedAt ? (
                        <Badge variant="destructive">Deleted</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Redemptions */}
      {data.redemptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Promo redemptions ({data.redemptions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Redeemed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.redemptions.map((r, i) => (
                  <TableRow key={`${r.code}-${i}`}>
                    <TableCell className="font-mono text-xs">{r.code ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.organizationId ?? "—"}</TableCell>
                    <TableCell>{formatDate(r.redeemedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Actions card */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Block / Unblock — mutually exclusive */}
          {isDisabled ? (
            <ActionRow
              icon={<UserCheck className="size-4" />}
              title="Unblock user"
              description="Re-enable sign-in. The user can log in again immediately."
              variant="default"
              pending={enableUser.isPending}
              onClick={() => runAction("Unblock", () => enableUser.mutateAsync(userId))}
            />
          ) : (
            <ActionRow
              icon={<Ban className="size-4" />}
              title="Block user"
              description="Prevent login without deleting data. Reversible via Unblock."
              variant="outline"
              pending={disableUser.isPending}
              onClick={() => runAction("Block", () => disableUser.mutateAsync(userId))}
            />
          )}

          <ActionRow
            icon={<LogOut className="size-4" />}
            title="Force sign-out from all sessions"
            description="Invalidates every refresh token and releases all device capacity. User must re-authenticate and re-activate every device."
            variant="outline"
            pending={signOutUser.isPending}
            onClick={() => runAction("Force sign-out", () => signOutUser.mutateAsync(userId))}
          />

          <ActionRow
            icon={<KeyRound className="size-4" />}
            title="Force password reset"
            description="Current password stops working immediately and the user gets a reset email."
            variant="outline"
            pending={resetPassword.isPending}
            onClick={() => runAction("Password reset", () => resetPassword.mutateAsync(userId))}
          />

          {/* Delete — with type-the-email confirmation */}
          <div className="rounded-md border p-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">
                <FlaskConical className="size-4" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-medium text-sm">Grant admin plan</p>
                  <p className="text-muted-foreground text-xs">
                    Creates a new non-Stripe organization for this user. Duplicate active admin-granted plans are
                    blocked server-side.
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-[180px_160px_auto]">
                  <Select value={grantPlan} onValueChange={setGrantPlan}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={grantDays}
                    onChange={(event) => setGrantDays(event.target.value)}
                    placeholder="Indefinite"
                    aria-label="Grant duration in days"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={grantOrg.isPending}
                    onClick={() =>
                      runAction("Grant admin plan", () =>
                        grantOrg.mutateAsync({
                          targetUserId: userId,
                          planTier: grantPlan,
                          maxDevices: defaultSeatsForPlan(grantPlan),
                          expiresInDays: grantDays ? Number.parseInt(grantDays, 10) : undefined,
                        }),
                      )
                    }
                  >
                    {grantOrg.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Grant
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {PLAN_OPTIONS.find((option) => option.value === grantPlan)?.label} grants use{" "}
                  {defaultSeatsForPlan(grantPlan) === 999999 ? "unlimited" : defaultSeatsForPlan(grantPlan)} seats by
                  default. Leave duration blank for indefinite access.
                </p>
              </div>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 size-4 text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive text-sm">Delete user</p>
                    <p className="text-muted-foreground text-xs">
                      Hard delete — removes from Cognito and cascade-cleans Profile, Memberships, devices, and
                      solo-owned orgs. Multi-member owned orgs must be transferred first.
                    </p>
                  </div>
                </div>
                <Button variant="destructive" size="sm">
                  Delete
                </Button>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {user.email ?? user.userId}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This is irreversible. The user&apos;s Cognito entry, Profile, Memberships, and DeviceActivations will
                  be deleted. Any organizations they solo-own will be soft-deleted with a 30-day grace period.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="confirm-email">
                  Type <span className="font-mono">{user.email}</span> to confirm
                </Label>
                <Input
                  id="confirm-email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={user.email ?? ""}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmEmail("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteConfirmEmail !== user.email || deleteUser.isPending}
                  onClick={() =>
                    runAction("Delete", () => deleteUser.mutateAsync(userId), {
                      redirectOnSuccess: true,
                    })
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteUser.isPending && <Loader2 className="size-4 animate-spin" />}
                  Delete user
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared action row ───────────────────────────────────────────────────────

function ActionRow({
  icon,
  title,
  description,
  variant,
  pending,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: "default" | "outline";
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <Button variant={variant} size="sm" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        Run
      </Button>
    </div>
  );
}
