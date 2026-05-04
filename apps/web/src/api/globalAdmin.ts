import { apiJson } from './client';

export interface AdminDashboardResponse {
  totals: {
    tenants: number;
    users: number;
    usersLoginActive: number;
    subscriptionsActiveOrTrialing: number;
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isLoginActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: string;
  memberships: { tenantId: string; tenantName: string; tenantSlug: string; role: string }[];
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminSubscriptionRow {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  planCode: string | null;
  planDisplayName: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface AdminSubscriptionsResponse {
  subscriptions: AdminSubscriptionRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SuperAdminRow {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isLoginActive: boolean;
  grantedAt: string;
}

export function fetchAdminDashboard() {
  return apiJson<AdminDashboardResponse>('/global-admin/dashboard');
}

export function fetchAdminUsers(params: URLSearchParams) {
  return apiJson<AdminUsersResponse>(`/global-admin/users?${params.toString()}`);
}

export function updateUserLoginStatus(userId: string, isLoginActive: boolean) {
  return apiJson<{ ok: true; id: string; isLoginActive: boolean }>(`/global-admin/users/${userId}/login-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isLoginActive }),
  });
}

export function fetchAdminSubscriptions(params: URLSearchParams) {
  return apiJson<AdminSubscriptionsResponse>(`/global-admin/subscriptions?${params.toString()}`);
}

export function updateSubscription(
  tenantId: string,
  payload: { status?: string; planCode?: string; extendDays?: number }
) {
  return apiJson<{ ok: true; id: string }>(`/global-admin/subscriptions/${tenantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchSuperAdmins() {
  return apiJson<{ superAdmins: SuperAdminRow[] }>('/global-admin/super-admins');
}

export function delegateSuperAdmin(email: string) {
  return apiJson<{ ok: true; userId: string; email: string }>('/global-admin/super-admins/delegate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function revokeSuperAdmin(userId: string) {
  return apiJson<void>(`/global-admin/super-admins/${userId}`, { method: 'DELETE' });
}
