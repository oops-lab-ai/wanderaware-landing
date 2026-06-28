import { useState } from "react";

import { Navigate } from "react-router";

import { Check, Copy, FlaskConical, Loader2, Plus, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminCodes,
  useAdminCreateCode,
  useAdminGrants,
  useAdminRevokeCode,
  useAdminUpdateGrant,
} from "@/hooks/use-admin";
import { useIsAdmin } from "@/hooks/use-is-admin";
import type { AdminCodeItem, AdminGrantItem } from "@/lib/amplify/data-client";

const PLAN_OPTIONS = [
  { value: "free", label: "Granted", defaultSeats: 1 },
  { value: "basic", label: "Starter", defaultSeats: 1 },
  { value: "professional", label: "Professional", defaultSeats: 5 },
  { value: "enterprise", label: "Enterprise", defaultSeats: 999999 },
];

function defaultSeatsForPlan(planTier: string) {
  return PLAN_OPTIONS.find((option) => option.value === planTier)?.defaultSeats ?? 1;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) {
    const abs = Math.abs(ms);
    const days = Math.floor(abs / (1000 * 60 * 60 * 24));
    if (days > 30) return `${Math.floor(days / 30)} mo ago`;
    if (days > 0) return `${days}d ago`;
    return "just now";
  }
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days > 30) return `in ${Math.floor(days / 30)} mo`;
  if (days > 0) return `in ${days}d`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `in ${hours}h`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(status: AdminGrantItem["status"]) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>
      );
    case "permanent":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Permanent</Badge>;
    case "expiring-soon":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Expiring soon</Badge>
      );
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
  }
}

// ── Active Grants tab ────────────────────────────────────────────────────────

function GrantsTab() {
  const { data, isLoading } = useAdminGrants();
  const updateGrant = useAdminUpdateGrant();
  const [customExpiry, setCustomExpiry] = useState<{ orgId: string; date: string } | null>(null);

  const grants = data?.grants ?? [];

  async function handleAction(orgId: string, action: "revoke" | "extend" | "permanent") {
    try {
      await updateGrant.mutateAsync({ organizationId: orgId, action, extensionDays: 30 });
      toast.success(
        `Grant ${action === "extend" ? "extended" : action === "permanent" ? "made permanent" : "revoked"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update grant");
    }
  }

  async function handleCustomExpiry() {
    if (!customExpiry) return;
    try {
      await updateGrant.mutateAsync({
        organizationId: customExpiry.orgId,
        action: "set-custom",
        customExpiresAt: new Date(customExpiry.date).toISOString(),
      });
      toast.success("Custom expiry set");
      setCustomExpiry(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set expiry");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (grants.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center">
        <FlaskConical className="mx-auto size-10 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground text-sm">No building plan grants yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Building</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Granted</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grants.map((g) => (
            <TableRow key={g.organizationId}>
              <TableCell className="font-medium">{g.organizationName}</TableCell>
              <TableCell className="text-sm">
                <div className="capitalize">{g.planTier ?? "free"}</div>
                <div className="text-muted-foreground text-xs">{g.maxDevices ?? 1} device slots</div>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{g.ownerEmail ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{formatDate(g.createdAt)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {g.grantExpiresAt ? formatRelative(g.grantExpiresAt) : "Never"}
              </TableCell>
              <TableCell>{statusBadge(g.status)}</TableCell>
              <TableCell>
                {g.sourceCode ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{g.sourceCode}</code>
                ) : (
                  <span className="text-muted-foreground text-xs">admin</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleAction(g.organizationId, "revoke")}>
                      <Trash2 className="size-3.5" />
                      Revoke now
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAction(g.organizationId, "extend")}>
                      <Plus className="size-3.5" />
                      Extend 30 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAction(g.organizationId, "permanent")}>
                      <Sparkles className="size-3.5" />
                      Make permanent
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setCustomExpiry({ orgId: g.organizationId, date: new Date().toISOString().slice(0, 10) })
                      }
                    >
                      Set custom expiry…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!customExpiry} onOpenChange={(open) => !open && setCustomExpiry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set custom expiry</DialogTitle>
            <DialogDescription>The grant will end at the start of this date.</DialogDescription>
          </DialogHeader>
          <Input
            type="date"
            value={customExpiry?.date ?? ""}
            onChange={(e) => customExpiry && setCustomExpiry({ ...customExpiry, date: e.target.value })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomExpiry(null)}>
              Cancel
            </Button>
            <Button onClick={handleCustomExpiry} disabled={updateGrant.isPending}>
              {updateGrant.isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Codes tab ────────────────────────────────────────────────────────────────

function CodesTab() {
  const { data, isLoading } = useAdminCodes();
  const createCode = useAdminCreateCode();
  const revokeCode = useAdminRevokeCode();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [label, setLabel] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [codeExpiresInDays, setCodeExpiresInDays] = useState("");
  const [planTier, setPlanTier] = useState("free");

  const codes = data?.codes ?? [];

  function redeemUrl(code: string) {
    return `${window.location.origin}/dashboard/redeem?code=${encodeURIComponent(code)}`;
  }

  async function writeClipboardText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        document.body.removeChild(textarea);
      }
      return copied;
    }
  }

  async function copyText(value: string, label: string) {
    if (await writeClipboardText(value)) {
      toast.success(`${label} copied`);
      return true;
    }
    toast.error(`Failed to copy ${label.toLowerCase()}`);
    return false;
  }

  async function handleCreate() {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    try {
      const result = await createCode.mutateAsync({
        label: label.trim(),
        maxRedemptions: parseInt(maxRedemptions, 10) || 1,
        expiresInDays: expiresInDays ? parseInt(expiresInDays, 10) : undefined,
        codeExpiresInDays: codeExpiresInDays ? parseInt(codeExpiresInDays, 10) : undefined,
        planTier,
        maxDevices: defaultSeatsForPlan(planTier),
      });
      if (result.success && result.code) {
        const url = redeemUrl(result.code);
        setCreatedUrl(url);
        toast.success("Code created");
        // Reset form for the next one
        setLabel("");
        setMaxRedemptions("1");
        setExpiresInDays("");
        setCodeExpiresInDays("");
        setPlanTier("free");
      } else {
        toast.error(result.message ?? "Failed to create code");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create code");
    }
  }

  async function handleCopy() {
    if (!createdUrl) return;
    if (await writeClipboardText(createdUrl)) {
      setCopied(true);
      toast.success("Redeem URL copied");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy");
    }
  }

  async function handleRevoke(code: string) {
    try {
      await revokeCode.mutateAsync(code);
      toast.success("Code revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create code
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">No promo codes yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Grant</TableHead>
                <TableHead>Code expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c: AdminCodeItem) => (
                <TableRow key={c.code}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c.code}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => copyText(c.code, "Code")}
                        aria-label="Copy code"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.label ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.redemptionCount} / {c.maxRedemptions}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="text-foreground capitalize">{c.planTier ?? "free"}</div>
                    <div>{c.maxDevices ?? 1} device slots</div>
                    <div>{c.expiresInDays ? `${c.expiresInDays} days` : "Indefinite"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.expiresAt ? formatDate(c.expiresAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {c.status === "active" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setShareUrl(redeemUrl(c.code))}>
                      <Copy className="size-3.5" />
                      URL
                    </Button>
                    {c.status === "active" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <X className="size-3.5" />
                            Revoke
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke this code?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The code link will stop accepting new redemptions immediately.
                              <strong className="ml-1">Existing grants from this code remain active</strong> until their
                              own expiry — manage those individually from the Active Grants tab.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => handleRevoke(c.code)}
                            >
                              Revoke code
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create promo code</DialogTitle>
            <DialogDescription>Generate a new plan grant redemption link.</DialogDescription>
          </DialogHeader>
          {createdUrl ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 p-3">
                <Label className="text-muted-foreground text-xs">Share this URL</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 break-all text-xs">{createdUrl}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={handleCopy}
                    aria-label="Copy redemption URL"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => {
                  setCreatedUrl(null);
                  setCreateOpen(false);
                }}
                className="w-full"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="label">Label</Label>
                  <Input
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Springer care center"
                  />
                  <p className="text-muted-foreground text-xs">For your reference only — not shown to redeemers.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-redemptions">Max redemptions</Label>
                  <Input
                    id="max-redemptions"
                    type="number"
                    min="1"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">How many people can claim this single URL.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grant-tier">Granted tier</Label>
                  <Select value={planTier} onValueChange={setPlanTier}>
                    <SelectTrigger id="grant-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} ({option.defaultSeats === 999999 ? "unlimited" : option.defaultSeats} device
                          slots)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Redeemers get this non-Stripe grant tier. Paid Stripe subscriptions remain separate.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expires-in-days">Grant duration (days)</Label>
                  <Input
                    id="expires-in-days"
                    type="number"
                    min="1"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    placeholder="Indefinite"
                  />
                  <p className="text-muted-foreground text-xs">
                    How long each redeemer&apos;s plan grant lasts. Leave blank for indefinite.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code-expires-in-days">Code expiry (days)</Label>
                  <Input
                    id="code-expires-in-days"
                    type="number"
                    min="1"
                    value={codeExpiresInDays}
                    onChange={(e) => setCodeExpiresInDays(e.target.value)}
                    placeholder="Never"
                  />
                  <p className="text-muted-foreground text-xs">
                    When the link itself stops accepting new redemptions. Leave blank for never.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createCode.isPending}>
                  {createCode.isPending && <Loader2 className="size-4 animate-spin" />}
                  Create code
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareUrl} onOpenChange={(open) => !open && setShareUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share redemption URL</DialogTitle>
            <DialogDescription>Send this full URL to the user who should claim the grant.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3">
            <Label className="text-muted-foreground text-xs">Redeem URL</Label>
            <code className="mt-1.5 block break-all text-xs">{shareUrl}</code>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareUrl(null)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                if (!shareUrl) return;
                const ok = await copyText(shareUrl, "Redeem URL");
                if (ok) setShareUrl(null);
              }}
            >
              <Copy className="size-4" />
              Copy URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGrantsPage() {
  const { isAdmin, isChecking } = useIsAdmin();
  const { data: grantsData } = useAdminGrants();

  // Frontend gate: even though the AppSync schema rejects non-admin queries,
  // we don't want the admin UI shell ("Manage building plan grants and promo codes…")
  // to flash for non-admins. Show a loader while Cognito resolves, then redirect.
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
          <ShieldAlert className="size-6" />
          Grants
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage building plan grants and promo codes. Changes are real-time — web sessions get kicked within minutes of
          revocation.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Active grants</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-bold text-2xl">{grantsData?.totalActive ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Expiring this week</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-bold text-2xl">{grantsData?.totalExpiringSoon ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Total ever granted</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-bold text-2xl">{grantsData?.totalEverGranted ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="grants">
        <TabsList>
          <TabsTrigger value="grants">Active Grants</TabsTrigger>
          <TabsTrigger value="codes">Codes</TabsTrigger>
        </TabsList>
        <TabsContent value="grants" className="mt-4">
          <GrantsTab />
        </TabsContent>
        <TabsContent value="codes" className="mt-4">
          <CodesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
