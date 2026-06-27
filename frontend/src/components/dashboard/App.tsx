import { lazy, Suspense } from "react";

import { BrowserRouter, Route, Routes } from "react-router";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MoleculeLoader } from "@/components/ui/molecule-loader";
import { Toaster } from "@/components/ui/sonner";
import "@/lib/amplify/auth-client";

import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import AuthGuard from "./layouts/AuthGuard";
import AuthV2Layout from "./layouts/AuthV2Layout";
import DashboardLayout from "./layouts/DashboardLayout";
import OverviewPage from "./views/overview/page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const LoginPage = lazy(() => import("./views/auth/v2/login/page"));
const RegisterPage = lazy(() => import("./views/auth/v2/register/page"));
const ConfirmPage = lazy(() => import("./views/auth/v2/confirm/page"));
const ForgotPasswordPage = lazy(() => import("./views/auth/v2/forgot-password/page"));

const BuildingsPage = lazy(() => import("./views/buildings/page"));
const DevicesPage = lazy(() => import("./views/devices/page"));
const TagsPage = lazy(() => import("./views/tags/page"));
const ParticipantsPage = lazy(() => import("./views/participants/page"));
const AlertsPage = lazy(() => import("./views/alerts/page"));
const BillingPage = lazy(() => import("./views/billing/page"));
const TeamPage = lazy(() => import("./views/team/page"));
const SettingsPage = lazy(() => import("./views/settings/page"));
const AdminGrantsPage = lazy(() => import("./views/admin/grants/page"));
const AdminOrgsPage = lazy(() => import("./views/admin/orgs/page"));
const AdminUsersPage = lazy(() => import("./views/admin/users/page"));

const AcceptInvitePage = lazy(() => import("./views/invite/page"));
const RedeemPage = lazy(() => import("./views/redeem/page"));
const WelcomePage = lazy(() => import("./views/welcome/page"));
const UnauthorizedPage = lazy(() => import("./views/unauthorized/page"));
const NotFound = lazy(() => import("./views/not-found/NotFound"));

function AppRoutes() {
  return (
    <Suspense fallback={<MoleculeLoader />}>
      <Routes>
        <Route element={<AuthV2Layout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="confirm" element={<ConfirmPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<AuthGuard />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="buildings" element={<BuildingsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin/orgs" element={<AdminOrgsPage />} />
            <Route path="admin/orgs/:organizationId" element={<AdminOrgsPage />} />
            <Route path="admin/grants" element={<AdminGrantsPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/users/:userId" element={<AdminUsersPage />} />
          </Route>
        </Route>

        <Route path="invite" element={<AcceptInvitePage />} />
        <Route path="redeem" element={<RedeemPage />} />
        <Route path="welcome" element={<WelcomePage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/dashboard">
      <QueryClientProvider client={queryClient}>
        <PreferencesStoreProvider>
          <AppRoutes />
          <Toaster />
        </PreferencesStoreProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
