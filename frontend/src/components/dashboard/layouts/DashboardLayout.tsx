import { Outlet } from "react-router";

import { AppSidebar } from "@/components/dashboard/sidebar/app-sidebar";
import { LayoutControls } from "@/components/dashboard/sidebar/layout-controls";
import { OrgSwitcher } from "@/components/dashboard/sidebar/org-switcher";
import { SearchDialog } from "@/components/dashboard/sidebar/search-dialog";
import { ThemeSwitcher } from "@/components/dashboard/sidebar/theme-switcher";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getClientCookie } from "@/lib/cookie.client";
import {
  SIDEBAR_COLLAPSIBLE_VALUES,
  SIDEBAR_VARIANT_VALUES,
  type SidebarCollapsible,
  type SidebarVariant,
} from "@/lib/preferences/layout";
import { cn } from "@/lib/utils";

function isSidebarVariant(value: string | undefined): value is SidebarVariant {
  return typeof value === "string" && (SIDEBAR_VARIANT_VALUES as readonly string[]).includes(value);
}

function isSidebarCollapsible(value: string | undefined): value is SidebarCollapsible {
  return typeof value === "string" && (SIDEBAR_COLLAPSIBLE_VALUES as readonly string[]).includes(value);
}

export default function Layout() {
  const defaultOpen = getClientCookie("sidebar_state") !== "false";
  const rawVariant = getClientCookie("sidebar_variant");
  const variant = isSidebarVariant(rawVariant) ? rawVariant : "inset";
  const rawCollapsible = getClientCookie("sidebar_collapsible");
  const collapsible = isSidebarCollapsible(rawCollapsible) ? rawCollapsible : "icon";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar variant={variant} collapsible={collapsible} />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&]:mx-auto! [html[data-content-layout=centered]_&]:max-w-screen-2xl!",
          "max-[113rem]:peer-data-[variant=inset]:mr-2! min-[101rem]:peer-data-[variant=inset]:peer-data-[state=collapsed]:mr-auto!",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <OrgSwitcher />
              <LayoutControls />
              <ThemeSwitcher />
            </div>
          </div>
        </header>
        <div className="h-full p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
