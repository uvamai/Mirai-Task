import { Routes, Route } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { PricingPage } from './pages/PricingPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { LegalPage } from './pages/LegalPage';
import { DashboardPage } from './pages/DashboardPage';
import { BoardPage } from './pages/BoardPage';
import { BillingPage } from './pages/BillingPage';
import { ProfilePage } from './pages/ProfilePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { ProjectLayout } from './pages/ProjectLayout';
import { ProjectTeamPage } from './pages/ProjectTeamPage';
import { ProjectReportsPage } from './pages/ProjectReportsPage';
import { LegacyBoardRedirect } from './pages/LegacyBoardRedirect';
import { ProjectBoardIndex } from './pages/ProjectBoardIndex';
import { TaskListPage } from './pages/TaskListPage';
import { TaskCalendarPage } from './pages/TaskCalendarPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { PublicIntakePage } from './pages/PublicIntakePage';
import { TenantOrgSettingsPage } from './pages/TenantOrgSettingsPage';
import { MyWorkPage } from './pages/MyWorkPage';
import { ProjectItsmSettingsPage } from './pages/ProjectItsmSettingsPage';
import { ProjectAutomationsPage } from './pages/ProjectAutomationsPage';
import { ProjectGettingStartedPage } from './pages/ProjectGettingStartedPage';
import { ProjectTemplatesPage } from './pages/ProjectTemplatesPage';
import { ContactSalesPage } from './pages/ContactSalesPage';
import { AdminPortalDashboardPage } from './pages/AdminPortalDashboardPage';
import { AdminPortalUsersPage } from './pages/AdminPortalUsersPage';
import { AdminPortalSubscriptionsPage } from './pages/AdminPortalSubscriptionsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/request/:tenantSlug/:projectId" element={<PublicIntakePage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact-sales" element={<ContactSalesPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="my-work" element={<MyWorkPage />} />
        <Route path="projects/:projectId/board" element={<LegacyBoardRedirect />} />
        <Route path="projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectBoardIndex />} />
          <Route path="boards/:boardId/list" element={<TaskListPage />} />
          <Route path="boards/:boardId/table" element={<TaskListPage />} />
          <Route path="boards/:boardId/calendar" element={<TaskCalendarPage />} />
          <Route path="boards/:boardId" element={<BoardPage />} />
          <Route path="getting-started" element={<ProjectGettingStartedPage />} />
          <Route path="templates" element={<ProjectTemplatesPage />} />
          <Route path="team" element={<ProjectTeamPage />} />
          <Route path="reports" element={<ProjectReportsPage />} />
          <Route path="automations" element={<ProjectAutomationsPage />} />
          <Route path="settings" element={<ProjectItsmSettingsPage />} />
        </Route>
        <Route path="billing" element={<BillingPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="org-settings" element={<TenantOrgSettingsPage />} />
        <Route path="admin-portal/dashboard" element={<AdminPortalDashboardPage />} />
        <Route path="admin-portal/users" element={<AdminPortalUsersPage />} />
        <Route path="admin-portal/subscriptions" element={<AdminPortalSubscriptionsPage />} />
      </Route>
    </Routes>
  );
}
