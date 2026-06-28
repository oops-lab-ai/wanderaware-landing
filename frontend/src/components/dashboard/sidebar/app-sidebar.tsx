import { useMemo } from "react";

import { Link } from "react-router";

import { Command } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { useSessionContext } from "@/contexts/session-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { OrgSwitcher } from "./org-switcher";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    })),
  );

  const session = useSessionContext();
  const { isAdmin } = useIsAdmin();

  // Filter the Admin nav group out for non-admins. Group has `id: 99` (per
  // navigation/sidebar/sidebar-items.ts). Cosmetic-only — schema gates the real auth.
  const filteredItems = useMemo(() => sidebarItems.filter((g) => g.id !== 99 || isAdmin), [isAdmin]);

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/">
                <Command />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-1 pb-2 group-data-[collapsible=icon]:hidden">
          <OrgSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: session.email.split("@")[0],
            email: session.email,
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
