import { Navigate, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../hooks';
import { clearSession, setSession } from '../features/auth/authSlice';
import { apiFetch, apiJson } from '../api/client';
import { useEffect, useState } from 'react';
import { LeftNav } from '../components/navigation/LeftNav';
import { TopCommandBar, type NotifRow } from '../components/navigation/TopCommandBar';
import { CommandPalette } from '../components/navigation/CommandPalette';

export function AppShell() {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const storedTenantId = useAppSelector((s) => s.auth.tenantId);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isProjectArea = Boolean(useMatch('/app/projects/:projectId/*'));
  const [, setLeftCollapsed] = useState(() => localStorage.getItem('mirai_leftnav_collapsed') === '1');

  const meShell = useQuery({
    queryKey: ['me-shell'],
    queryFn: () =>
      apiJson<{
        membership: { role: string };
        tenant: { id: string; name: string } | null;
        isGlobalAdmin: boolean;
      }>('/auth/me'),
    enabled: Boolean(accessToken),
  });

  const unreadQ = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => apiJson<{ count: number }>('/notifications/unread-count'),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });

  const notifQ = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiJson<{ notifications: NotifRow[] }>('/notifications?limit=30'),
    enabled: Boolean(accessToken) && notifOpen,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const res = await apiFetch('/notifications/read-all', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  /** Align Redux/localStorage tenant with the JWT-backed tenant from `/auth/me` (fixes stale `mirai_tenant_id`). */
  useEffect(() => {
    const apiTenant = meShell.data?.tenant?.id;
    if (!accessToken || !apiTenant || meShell.isError) return;
    if (storedTenantId !== apiTenant) {
      dispatch(setSession({ accessToken, tenantId: apiTenant }));
      void qc.invalidateQueries();
    }
  }, [accessToken, storedTenantId, meShell.data?.tenant?.id, meShell.isError, dispatch, qc]);

  // Global Cmd/Ctrl+K palette.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === 'k';
      if (!isK) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setPaletteOpen(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  async function logout() {
    const refresh = localStorage.getItem('mirai_refresh_token');
    if (refresh) {
      await apiFetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      }).catch(() => undefined);
    }
    dispatch(clearSession());
    navigate('/');
  }

  if (meShell.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const unread = unreadQ.data?.count ?? 0;
  const tenantName = meShell.data?.tenant?.name ?? 'Workspace';
  const isAdmin = meShell.data?.membership.role === 'ADMIN';
  const apiTenantId = meShell.data?.tenant?.id;
  const isGlobalAdmin = !!meShell.data?.isGlobalAdmin;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <a
        href="#app-main-content"
        className="fixed left-3 top-3 z-[200] -translate-y-24 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        Skip to main content
      </a>
      <div className="flex w-full">
        <LeftNav tenantName={tenantName} isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} onCollapseChange={setLeftCollapsed} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopCommandBar
            tenantName={tenantName}
            unread={unread}
            notifications={notifQ.data?.notifications ?? []}
            notifOpen={notifOpen}
            setNotifOpen={setNotifOpen}
            onMarkAllRead={() => markAll.mutate()}
            onMarkRead={(id) => markRead.mutate(id)}
            onOpenPalette={() => setPaletteOpen(true)}
            onLogout={() => void logout()}
          />
          <main
            id="app-main-content"
            className={
              isProjectArea
                ? 'min-h-0 w-full flex-1 px-0 py-0'
                : 'mx-auto min-h-0 w-full max-w-6xl flex-1 px-6 py-10'
            }
            tabIndex={-1}
          >
            <Outlet context={{ isAdmin, isGlobalAdmin, tenantId: apiTenantId }} />
          </main>
        </div>
      </div>
    </div>
  );
}
