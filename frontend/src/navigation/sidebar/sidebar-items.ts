import {
  Bell,
  Building2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  RadioTower,
  Settings,
  ShieldAlert,
  Tag,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: "Overview",
        url: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Buildings",
        url: "/buildings",
        icon: Building2,
      },
      {
        title: "Devices",
        url: "/devices",
        icon: RadioTower,
      },
      {
        title: "Tags",
        url: "/tags",
        icon: Tag,
      },
      {
        title: "Participants",
        url: "/participants",
        icon: UsersRound,
      },
      {
        title: "Alerts",
        url: "/alerts",
        icon: Bell,
      },
      {
        title: "Team",
        url: "/team",
        icon: Users,
      },
      {
        title: "Billing",
        url: "/billing",
        icon: CreditCard,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
  {
    id: 2,
    label: "Resources",
    items: [
      {
        title: "Support",
        url: "mailto:support@wanderaware.com",
        icon: LifeBuoy,
        newTab: true,
      },
    ],
  },
  // Admin nav group — only rendered when useIsAdmin() returns true (filter happens
  // in app-sidebar.tsx). The schema gates the actual data, so this is cosmetic.
  {
    id: 99,
    label: "Admin",
    items: [
      {
        title: "Buildings",
        url: "/admin/orgs",
        icon: Building2,
      },
      {
        title: "Grants",
        url: "/admin/grants",
        icon: ShieldAlert,
      },
      {
        title: "Users",
        url: "/admin/users",
        icon: UserCog,
      },
    ],
  },
];
