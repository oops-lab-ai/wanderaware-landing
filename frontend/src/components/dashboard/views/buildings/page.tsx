import { useState } from "react";

import { useNavigate } from "react-router";

import {
  Building2,
  Check,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Plus,
  RadioTower,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionContext } from "@/contexts/session-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useCreateOrganization } from "@/hooks/use-mutations";
import { roleBadgeVariant } from "@/lib/dashboard-utils";
import { MAX_ORGANIZATION_NAME_LENGTH, normalizeOrganizationName } from "@/lib/organization-name";
import { getTierDisplayName } from "@/lib/plan-utils";
import { cn } from "@/lib/utils";

export default function BuildingsPage() {
  const { organization, organizations, switchOrganization } = useSessionContext();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const createBuilding = useCreateOrganization();

  async function handleCreateBuilding() {
    const name = normalizeOrganizationName(newBuildingName);
    if (!name) {
      toast.error("Building name is required");
      return;
    }

    try {
      const result = await createBuilding.mutateAsync({ name });
      if (result.organizationId) {
        switchOrganization(result.organizationId);
        toast.success("Building added");
      }
      setNewBuildingName("");
      setCreateDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add building");
    }
  }

  function selectBuilding(buildingId: string) {
    if (buildingId !== organization.id) {
      switchOrganization(buildingId);
    }
  }

  function selectAndNavigate(buildingId: string, path: string) {
    selectBuilding(buildingId);
    navigate(path);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <Building2 className="size-6" />
            Buildings
          </h1>
          <p className="text-muted-foreground text-sm">
            Each building has its own plan, device capacity, team access, and billing.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          Add Building
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {organizations.map((building) => {
          const buildingId = building.organizationId;
          if (!buildingId) return null;
          const isActive = buildingId === organization.id;
          const planLabel = building.planTier ? getTierDisplayName(building.planTier) : "No plan";

          return (
            <Card
              key={buildingId}
              className={cn(
                "transition-colors",
                isActive ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/15" : "hover:border-primary/40",
              )}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{building.name ?? "Unnamed building"}</CardTitle>
                    <CardDescription className="mt-1">Billable building account</CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isActive ? (
                      <Badge className="gap-1">
                        <Check className="size-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Available</Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Building actions">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => selectAndNavigate(buildingId, "/settings")}>
                          <Settings className="size-4" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => selectAndNavigate(buildingId, "/billing")}>
                          <CreditCard className="size-4" />
                          Billing
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => selectAndNavigate(buildingId, "/team")}>
                          <Users className="size-4" />
                          Team
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => selectAndNavigate(buildingId, "/devices")}>
                          <RadioTower className="size-4" />
                          Devices
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => selectAndNavigate(buildingId, `/admin/orgs/${buildingId}`)}
                            >
                              <Shield className="size-4" />
                              Admin details
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plan</p>
                    <p className="font-medium">{planLabel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Capacity</p>
                    <p className="font-medium">{building.maxDevices ?? 0} devices</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Your role</p>
                    <Badge variant={roleBadgeVariant(building.role)}>{building.role ?? "member"}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Billing</p>
                    <p className="font-medium">{building.subscriptionStatus ?? "Not started"}</p>
                  </div>
                </div>
                <Button
                  variant={isActive ? "secondary" : "outline"}
                  className="w-full"
                  disabled={isActive}
                  onClick={() => selectBuilding(buildingId)}
                >
                  {isActive ? "Current Building" : "Switch to Building"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Building</DialogTitle>
            <DialogDescription>
              Create a new facility account when a location needs separate billing or device capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-building-name">Building Name</Label>
            <Input
              id="new-building-name"
              value={newBuildingName}
              onChange={(event) => setNewBuildingName(event.target.value)}
              placeholder="Main Day Center"
              maxLength={MAX_ORGANIZATION_NAME_LENGTH}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateBuilding();
              }}
            />
            <p className="text-muted-foreground text-xs">
              {newBuildingName.length}/{MAX_ORGANIZATION_NAME_LENGTH} characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBuilding} disabled={createBuilding.isPending}>
              {createBuilding.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Add Building
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
