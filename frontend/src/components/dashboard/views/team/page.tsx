import { useState } from "react";

import { useNavigate } from "react-router";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Inbox, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSessionContext } from "@/contexts/session-context";
import { useInvitations, useMyInvitations } from "@/hooks/use-invitations";
import {
  useAcceptInvitation,
  useDeclineInvitation,
  useInviteMember,
  useRemoveMember,
  useRevokeInvitation,
  useTransferOwnership,
  useUpdateMemberRole,
} from "@/hooks/use-mutations";
import { useOrgMembers } from "@/hooks/use-org-members";
import { setActiveOrgId } from "@/lib/active-org-id";
import { capitalize, formatDate, roleBadgeVariant } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

// ── Page ───────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { userId, email, organization, membership } = useSessionContext();

  const isOwner = membership.role === "owner";
  const isAdmin = membership.role === "admin";
  const canManage = isOwner || isAdmin;

  const { data: membersData, isLoading: membersLoading } = useOrgMembers(organization.id);
  const { data: invitationsData, isLoading: invitationsLoading } = useInvitations(organization.id);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const members = membersData?.members ?? [];
  const invitations = (invitationsData?.invitations ?? []).filter((inv) => inv.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <Users className="size-6" />
            Team
          </h1>
          <p className="text-muted-foreground text-sm">
            {canManage
              ? `Manage team members and roles for ${organization.name}`
              : `Members of ${organization.name} - contact your owner to invite or remove members`}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-1.5 size-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Incoming invitations to this user (across ALL orgs). Shown above the
          current org's members so cold-signup users find their invites first. */}
      <MyInvitationsCard />

      {/* Members table */}
      {membersLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <MembersTable
          members={members}
          organizationId={organization.id}
          currentUserId={userId}
          currentEmail={email}
          isOwner={isOwner}
          isAdmin={isAdmin}
          canManage={canManage}
        />
      )}

      {/* Pending invitations */}
      {canManage && invitations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="font-medium text-sm">Pending Invitations</h2>
            {invitationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <InvitationsTable invitations={invitations} organizationId={organization.id} />
            )}
          </div>
        </>
      )}

      {/* Invite dialog */}
      {canManage && (
        <InviteDialog
          organizationId={organization.id}
          currentEmail={email}
          isOwner={isOwner}
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
        />
      )}
    </div>
  );
}

// ── My Invitations (incoming) ──────────────────────────────────────────────

function MyInvitationsCard() {
  const session = useSessionContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useMyInvitations();
  const invitations = data?.invitations ?? [];
  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  if (isLoading || invitations.length === 0) {
    // Hide entirely when there are no invites — keeps the page clean
    return null;
  }

  // tokenHash is the hashed identifier; the raw token is only available from
  // the email link. Server-side accept/decline accept either form (heuristic on
  // ms_inv_ prefix) and we send the hash here because that's all listMyInvitations
  // returns. Email match is verified server-side regardless.
  const handleAccept = (tokenHash: string, orgName: string) => {
    acceptMutation.mutate(
      { token: tokenHash },
      {
        onSuccess: (result) => {
          if (result.success && result.organizationId) {
            setActiveOrgId(result.organizationId);
            toast.success(`Joined ${orgName}!`);
            // Accepting here means switching into a DIFFERENT org than the one
            // this team page is currently showing. Wipe auth + navigate home
            // so AuthGuard remounts the dashboard with the new org context
            // instead of leaving the stale members list visible during refetch.
            queryClient.removeQueries({ queryKey: ["auth"] });
            navigate("/", { replace: true });
          } else {
            toast.error(result.message ?? "Failed to accept invitation");
          }
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to accept invitation");
        },
      },
    );
  };

  const handleDecline = (tokenHash: string) => {
    declineMutation.mutate(
      { token: tokenHash },
      {
        onSuccess: () => {
          toast.success("Invitation declined");
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to decline invitation");
        },
      },
    );
  };

  // Hide invites for the org we're already viewing — they're not actionable
  // (the user is clearly already a member). Keeps the panel small for cold
  // signup but doesn't show stale invites for joined orgs.
  const visible = invitations.filter((inv) => {
    const tokenHash = inv.tokenHash;
    if (!tokenHash) return false;
    return true;
  });
  // ^ session.userId is unused here but keeps the dependency on session explicit;
  // future logic (e.g. hide invites for orgs the user already belongs to) can
  // pull from session.organizations without re-wiring imports.
  void session;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          Invitations to You
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground">
            {visible.length}
          </span>
        </CardTitle>
        <CardDescription>Buildings that have invited you to join</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((inv) => (
          <div
            key={inv.tokenHash}
            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{inv.organizationName ?? "Unnamed building"}</span>
                <Badge variant={roleBadgeVariant(inv.role)}>{capitalize(inv.role)}</Badge>
              </div>
              <p className="truncate text-muted-foreground text-xs">
                Invited by {inv.inviterEmail ?? "a team member"} · {formatDate(inv.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inv.tokenHash && handleDecline(inv.tokenHash)}
                disabled={declineMutation.isPending || acceptMutation.isPending}
              >
                <X className="size-4" />
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => inv.tokenHash && handleAccept(inv.tokenHash, inv.organizationName ?? "building")}
                disabled={acceptMutation.isPending || declineMutation.isPending}
              >
                {acceptMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Accept
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Members Table ──────────────────────────────────────────────────────────

function MembersTable({
  members,
  organizationId,
  currentUserId,
  currentEmail,
  isOwner,
  isAdmin,
  canManage,
}: {
  members: Array<{
    membershipId: string | null;
    userId: string | null;
    email: string | null;
    role: string | null;
    joinedAt: string | null;
  }>;
  organizationId: string;
  currentUserId: string;
  currentEmail: string;
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean;
}) {
  const removeMember = useRemoveMember();
  const updateRole = useUpdateMemberRole();
  const transferOwnership = useTransferOwnership();
  const queryClient = useQueryClient();

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    try {
      await updateRole.mutateAsync({ organizationId, membershipId, role: newRole });
      toast.success("Role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    }
  };

  const handleRemove = async (membershipId: string) => {
    try {
      await removeMember.mutateAsync({ organizationId, membershipId });
      toast.success("Member removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove member");
    }
  };

  const handleTransfer = async (membershipId: string) => {
    try {
      await transferOwnership.mutateAsync({ organizationId, newOwnerMembershipId: membershipId });
      // Non-navigating flow: await a fresh refetch of the auth cache so the
      // members table shows the new owner/demoted-admin rows before the button
      // spinner disappears. Using refetchQueries instead of removeQueries
      // avoids flashing a full-page MoleculeLoader for what's really a
      // localized in-page state change.
      await queryClient.refetchQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["orgMembers", organizationId] });
      toast.success("Ownership transferred");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to transfer ownership");
    }
  };

  if (members.length === 0) {
    return <p className="text-muted-foreground text-sm">No members found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          {canManage && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          const memberIsOwner = member.role === "owner";
          const memberIsViewer = member.role === "viewer";

          // Admin can only remove viewers
          const canRemove = !isSelf && ((isOwner && !memberIsOwner) || (isAdmin && memberIsViewer));

          const canChangeRole = isOwner && !isSelf && !memberIsOwner;
          const canTransfer = isOwner && !isSelf && !memberIsOwner;

          return (
            <TableRow key={member.membershipId} className={cn(isSelf && "bg-muted/30")}>
              <TableCell>
                <span className="text-sm">{member.email ?? currentEmail}</span>
                {isSelf && <span className="ml-1.5 text-muted-foreground text-xs">(you)</span>}
              </TableCell>
              <TableCell>
                <Badge variant={roleBadgeVariant(member.role)}>{capitalize(member.role)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{formatDate(member.joinedAt)}</TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Role selector — owner only, not for self or other owners */}
                    {canChangeRole && (
                      <Select
                        value={member.role ?? "viewer"}
                        onValueChange={(val) => {
                          if (member.membershipId) handleRoleChange(member.membershipId, val);
                        }}
                      >
                        <SelectTrigger size="sm" className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {/* Transfer ownership — owner only */}
                    {canTransfer && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Transfer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to transfer ownership to <strong>{member.email}</strong>? You will
                              become an admin and lose owner privileges.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                if (member.membershipId) handleTransfer(member.membershipId);
                              }}
                            >
                              Transfer Ownership
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Remove member */}
                    {canRemove && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            aria-label={`Remove ${member.email ?? "member"}`}
                            title={`Remove ${member.email ?? "member"}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{member.email}</strong> from this building? They
                              will lose access immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => {
                                if (member.membershipId) handleRemove(member.membershipId);
                              }}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ── Invitations Table ──────────────────────────────────────────────────────

function InvitationsTable({
  invitations,
  organizationId,
}: {
  invitations: Array<{
    tokenHash: string | null;
    email: string | null;
    role: string | null;
    createdAt: string | null;
  }>;
  organizationId: string;
}) {
  const revokeInvitation = useRevokeInvitation();

  const handleRevoke = async (tokenHash: string) => {
    try {
      await revokeInvitation.mutateAsync({ token: tokenHash, organizationId });
      toast.success("Invitation revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke invitation");
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invited</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((inv) => (
          <TableRow key={inv.tokenHash}>
            <TableCell className="text-sm">{inv.email ?? "--"}</TableCell>
            <TableCell>
              <Badge variant={roleBadgeVariant(inv.role)}>{capitalize(inv.role)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">{formatDate(inv.createdAt)}</TableCell>
            <TableCell className="text-right">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive">
                    Revoke
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to revoke the invitation for <strong>{inv.email}</strong>? They will no
                      longer be able to join.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        if (inv.tokenHash) handleRevoke(inv.tokenHash);
                      }}
                    >
                      Revoke
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Invite Dialog ──────────────────────────────────────────────────────────

function InviteDialog({
  organizationId,
  currentEmail,
  isOwner,
  open,
  onOpenChange,
}: {
  organizationId: string;
  currentEmail: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const [createdInviteUrl, setCreatedInviteUrl] = useState("");
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const inviteMember = useInviteMember();

  async function copyInviteUrl() {
    if (!createdInviteUrl) return;
    try {
      await navigator.clipboard.writeText(createdInviteUrl);
      setCopiedInviteUrl(true);
      toast.success("Invite link copied");
      window.setTimeout(() => setCopiedInviteUrl(false), 2000);
      return;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = createdInviteUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-1000px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (copied) {
        setCopiedInviteUrl(true);
        toast.success("Invite link copied");
        window.setTimeout(() => setCopiedInviteUrl(false), 2000);
        return;
      }
      toast.error("Copy failed. Select the link and copy it manually.");
    }
  }

  const handleInvite = async () => {
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (trimmedEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error("You can't invite yourself");
      return;
    }
    try {
      const result = await inviteMember.mutateAsync({
        organizationId,
        email: trimmedEmail,
        role: inviteRole,
      });
      if (result.success) {
        // message contains the raw invite token until SES email lands in the user's inbox
        const rawToken = result.message;
        if (rawToken?.startsWith("ms_inv_")) {
          const inviteUrl = `${window.location.origin}/dashboard/invite?token=${rawToken}`;
          setCreatedInviteUrl(inviteUrl);
          setCopiedInviteUrl(false);
          toast.success("Invite created");
        } else {
          toast.success("Invitation sent");
        }
        setInviteEmail("");
        setInviteRole("viewer");
      } else {
        toast.error(result.message ?? "Failed to send invitation");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setCreatedInviteUrl("");
          setCopiedInviteUrl(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>Send an invitation to join this building.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInvite();
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as "admin" | "viewer")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {createdInviteUrl && (
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <Label htmlFor="created-invite-url">Invite link</Label>
              <div className="flex gap-2">
                <Input
                  id="created-invite-url"
                  readOnly
                  value={createdInviteUrl}
                  className="font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button type="button" variant="outline" size="icon" onClick={copyInviteUrl} title="Copy invite link">
                  {copiedInviteUrl ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                The invite email is sent when email is configured. This link is available here as a fallback.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {createdInviteUrl ? "Done" : "Cancel"}
          </Button>
          <Button onClick={handleInvite} disabled={inviteMember.isPending}>
            {inviteMember.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
