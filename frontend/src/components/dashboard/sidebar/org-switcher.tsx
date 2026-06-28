import { useState } from "react";

import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionContext } from "@/contexts/session-context";
import { useCreateOrganization } from "@/hooks/use-mutations";
import { roleBadgeVariant } from "@/lib/dashboard-utils";
import { getTierDisplayName } from "@/lib/plan-utils";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { organization, membership, organizations, switchOrganization } = useSessionContext();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const createOrg = useCreateOrganization();

  const handleCreateOrg = async () => {
    const name = newOrgName.trim();
    if (!name) {
      toast.error("Building name is required");
      return;
    }

    try {
      const result = await createOrg.mutateAsync({ name });
      if (result.organizationId) {
        toast.success("Building created");
        switchOrganization(result.organizationId);
      }
      setCreateDialogOpen(false);
      setNewOrgName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create building");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-auto w-full justify-start gap-2 px-3 py-2 text-left">
            <Building2 className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] text-muted-foreground leading-tight">Active building</span>
              <span className="block truncate font-medium text-sm leading-tight">{organization.name}</span>
            </span>
            <Badge variant={roleBadgeVariant(membership.role)} className="shrink-0 px-1 py-0 text-[10px]">
              {membership.role ?? "member"}
            </Badge>
            <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="text-muted-foreground text-xs">Buildings</DropdownMenuLabel>
          <DropdownMenuGroup>
            {organizations.map((org) => {
              const isActive = org.organizationId === organization.id;
              return (
                <DropdownMenuItem
                  key={org.organizationId}
                  className={cn("cursor-pointer gap-2", isActive && "bg-accent")}
                  onClick={() => {
                    if (!isActive && org.organizationId) {
                      switchOrganization(org.organizationId);
                    }
                  }}
                >
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate text-sm">{org.name ?? "Unnamed building"}</span>
                  {/* Plan-status chip — closes the multi-org panic case ("I just paid, why
                      is it asking me again?"). Two states: outline "No Plan" for unsubscribed,
                      secondary tier name for paid. Trial / past_due sub-states aren't on
                      UserOrgItem (would need backend plumbing) — see ORG_SWITCHER_AND_CHIPS.md. */}
                  {org.planTier == null ? (
                    <Badge variant="outline" className="h-4 px-1 font-normal text-[10px]">
                      No Plan
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="h-4 px-1 font-normal text-[10px]">
                      {getTierDisplayName(org.planTier)}
                    </Badge>
                  )}
                  <Badge variant={roleBadgeVariant(org.role)} className="px-1 py-0 text-[10px]">
                    {org.role ?? "member"}
                  </Badge>
                  {isActive && <Check className="size-3.5 shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-3.5" />
            <span className="text-sm">Add Building</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Building</DialogTitle>
            <DialogDescription>
              Add a facility with its own plan, device capacity, team access, and billing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-org-name">Building Name</Label>
            <Input
              id="new-org-name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Main Day Center"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateOrg();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={createOrg.isPending}>
              {createOrg.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
