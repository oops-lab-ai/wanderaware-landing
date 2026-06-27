import { useEffect, useState } from "react";

import { useNavigate } from "react-router";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, DoorOpen, KeyRound, Loader2, Mail, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { passwordSchema } from "@/components/auth/password-schema";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useSessionContext } from "@/contexts/session-context";
import { useAuthMethods, useDisconnectProvider } from "@/hooks/use-auth-methods";
import { useLeaveOrganization, useRemoveOrganization } from "@/hooks/use-mutations";
import { setActiveOrgId } from "@/lib/active-org-id";
import { updateOrganization, updateProfile } from "@/lib/amplify/data-client";
import { MAX_ORGANIZATION_NAME_LENGTH, normalizeOrganizationName } from "@/lib/organization-name";

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { userId, email, profile, organization, membership } = useSessionContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isOwner = membership.role === "owner";

  const [newsletter, setNewsletter] = useState(profile.newsLetter ?? false);
  const [newsletterSaving, setNewsletterSaving] = useState(false);

  const [orgName, setOrgName] = useState(organization.name);
  const [orgNameSaving, setOrgNameSaving] = useState(false);

  const [copiedOrgId, setCopiedOrgId] = useState(false);

  // Danger Zone state
  const removeOrgMutation = useRemoveOrganization();
  const leaveOrgMutation = useLeaveOrganization();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // Both delete and leave funnel through this same post-success cleanup.
  // 1. Clear the per-user active-org pointer (only this user — shared care center web safe).
  // 2. Remove (not just invalidate) the ["auth"] cache so it enters loading state
  //    immediately. This ensures AuthGuard shows a loader while refetching instead
  //    of briefly flashing the stale org name in the sidebar.
  // 3. Navigate directly to the zero-org welcome route. AuthGuard will show a
  //    loader while the auth query refetches and clears the deleted org.
  const handlePostExit = (toastMessage: string) => {
    setActiveOrgId(null);
    queryClient.removeQueries({ queryKey: ["auth"] });
    toast.success(toastMessage);
    navigate("/welcome", { replace: true });
  };

  const handleDelete = async () => {
    try {
      const result = await removeOrgMutation.mutateAsync({
        organizationId: organization.id,
        confirmName,
      });
      if (result.success) {
        setDeleteDialogOpen(false);
        setConfirmName("");
        handlePostExit(`${organization.name} deleted`);
      } else {
        toast.error(result.message ?? "Failed to delete organization");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete organization");
    }
  };

  const handleLeave = async () => {
    try {
      const result = await leaveOrgMutation.mutateAsync({ organizationId: organization.id });
      if (result.success) {
        setLeaveDialogOpen(false);
        handlePostExit(`You have left ${organization.name}`);
      } else {
        toast.error(result.message ?? "Failed to leave organization");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to leave organization");
    }
  };

  // Reset local state when org switches
  useEffect(() => {
    setOrgName(organization.name);
    setCopiedOrgId(false);
  }, [organization.name]);

  // ── Profile handlers ──────────────────────────────────────────────────

  const handleNewsletterChange = async (checked: boolean) => {
    setNewsletter(checked);
    setNewsletterSaving(true);
    try {
      await updateProfile(userId, { newsLetter: checked });
      toast.success("Newsletter preference updated");
    } catch (_e) {
      setNewsletter(!checked);
      toast.error("Failed to update newsletter preference");
    } finally {
      setNewsletterSaving(false);
    }
  };

  // ── Organization handlers ─────────────────────────────────────────────

  const handleOrgNameSave = async () => {
    const newName = normalizeOrganizationName(orgName);
    if (!newName) {
      toast.error("Organization name cannot be empty");
      return;
    }
    setOrgNameSaving(true);
    try {
      await updateOrganization(organization.id, { name: newName });
      // Update the cached ["auth"] data in place — no refetch needed, no AuthGuard
      // re-render. The org name lives inside the cached organizations[] array.
      queryClient.setQueryData<{ organizations: { organizationId: string | null; name: string | null }[] } | undefined>(
        ["auth"],
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            organizations: prev.organizations.map((o) =>
              o.organizationId === organization.id ? { ...o, name: newName } : o,
            ),
          };
        },
      );
      // Also invalidate the heavyweight ["organization", id] query so Billing's
      // useOrganization hook picks up any other org-level fields that may have changed.
      queryClient.invalidateQueries({ queryKey: ["organization", organization.id] });
      toast.success("Organization name updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update organization name");
    } finally {
      setOrgNameSaving(false);
    }
  };

  const handleCopyOrgId = async () => {
    try {
      await navigator.clipboard.writeText(organization.id);
      setCopiedOrgId(true);
      toast.success("Organization ID copied to clipboard");
      setTimeout(() => setCopiedOrgId(false), 2000);
    } catch (_e) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your profile and organization</p>
      </div>

      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Profile
          </CardTitle>
          <CardDescription>Your personal account settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-muted-foreground text-sm">{email}</p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="newsletter">Newsletter</Label>
              <p className="text-muted-foreground text-sm">Receive product updates and announcements</p>
            </div>
            <Switch
              id="newsletter"
              checked={newsletter}
              onCheckedChange={handleNewsletterChange}
              disabled={newsletterSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization section.
          - Owners see the editable name + org ID.
          - Non-owners see ONLY the org ID (useful for support tickets). The
            grayed-out name input is hidden to avoid the awkward "looks editable
            but isn't" UX. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            Organization
          </CardTitle>
          <CardDescription>
            {isOwner ? "Manage your organization details" : `You're a member of ${organization.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOwner && (
            <>
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="My Organization"
                    maxLength={MAX_ORGANIZATION_NAME_LENGTH}
                  />
                  <Button onClick={handleOrgNameSave} disabled={orgNameSaving}>
                    {orgNameSaving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {orgName.length}/{MAX_ORGANIZATION_NAME_LENGTH} characters
                </p>
              </div>

              <Separator />
            </>
          )}

          <div className="space-y-2">
            <Label>Organization ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                {organization.id}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyOrgId} aria-label="Copy organization ID">
                {copiedOrgId ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            {!isOwner && (
              <p className="text-muted-foreground text-xs">
                Share this ID with support if you need help with your account.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ConnectedAccountsCard />

      {/* Danger Zone — owners see Delete (with name confirmation), non-owners
          see Leave (with a simple confirm). Both clear the active-org pointer
          and navigate to /, letting AuthGuard handle the orgless redirect to
          /welcome if no orgs remain. */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            {isOwner
              ? "Permanently remove access to this organization for all members."
              : "Remove yourself from this organization."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">Delete this organization</p>
                <p className="text-muted-foreground text-sm">
                  All members will lose access immediately. Active Stripe subscriptions must be cancelled first.
                </p>
              </div>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                  setDeleteDialogOpen(open);
                  if (!open) setConfirmName("");
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="size-4" />
                    Delete Organization
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove access to the organization. All members will lose access immediately and all web
                      sessions for this org will be released. If this organization has an active Stripe subscription,
                      you'll need to cancel it from the Billing page first.
                      <br />
                      <br />
                      Type <strong>{organization.name}</strong> below to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2 py-2">
                    <Label htmlFor="confirm-org-name">Organization name</Label>
                    <Input
                      id="confirm-org-name"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={organization.name}
                      autoFocus
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDelete}
                      disabled={confirmName !== organization.name || removeOrgMutation.isPending}
                    >
                      {removeOrgMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Delete Organization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">Leave this organization</p>
                <p className="text-muted-foreground text-sm">
                  You'll lose access to {organization.name} immediately. Any web devices you've signed in on for this
                  org will be released.
                </p>
              </div>
              <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <DoorOpen className="size-4" />
                    Leave Organization
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave {organization.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll lose access immediately and your web sessions for this org will be released. The
                      organization itself stays intact for the other members.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLeave} disabled={leaveOrgMutation.isPending}>
                      {leaveOrgMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Leave
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Connected Accounts ─────────────────────────────────────────────────────
// Hidden when no federated identity is linked — until a user signs in with
// Google there's nothing to disconnect. Disconnecting always requires a new
// password: PreSignUp may have issued a server-generated random one the user
// doesn't know, so we can't trust that they have a working email+password
// fallback today.

function ConnectedAccountsCard() {
  const { data } = useAuthMethods();
  const disconnect = useDisconnectProvider();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  const isGoogleLinked = (data?.linkedProviders ?? []).includes("Google");

  if (!isGoogleLinked) return null;

  const handleDisconnect = async () => {
    const validation = passwordSchema.safeParse(pw);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (pw !== pwConfirm) {
      toast.error("Passwords don't match");
      return;
    }
    try {
      const result = await disconnect.mutateAsync({ providerName: "Google", newPassword: pw });
      if (result.success) {
        toast.success(result.message ?? "Google disconnected");
        setOpen(false);
        setPw("");
        setPwConfirm("");
      } else {
        toast.error(result.message ?? "Failed to disconnect Google");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Google");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Connected accounts
        </CardTitle>
        <CardDescription>Manage how you sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Google</div>
            <div className="text-muted-foreground text-xs">Connected</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(true);
              setPw("");
              setPwConfirm("");
            }}
          >
            Disconnect
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Set a password to use with your email going forward. You'll still be able to re-add Google later by
                  signing in with it.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="dc-pw">New password</Label>
                  <Input
                    id="dc-pw"
                    type="password"
                    autoComplete="new-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dc-pw-confirm">Confirm password</Label>
                  <Input
                    id="dc-pw-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnect.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDisconnect();
              }}
              disabled={disconnect.isPending || !pw || !pwConfirm}
            >
              {disconnect.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
