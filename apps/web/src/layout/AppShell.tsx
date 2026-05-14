import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../hooks';
import { clearSession } from '../features/auth/authSlice';
import { apiFetch, apiJson } from '../api/client';
import { useEffect, useRef, useState } from 'react';

type NotifRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export function AppShell() {
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const meShell = useQuery({
    queryKey: ['me-shell'],
    queryFn: () => apiJson<{ membership: { role: string } }>('/auth/me'),
    enabled: Boolean(accessToken),
  });
  const globalAdmin = useQuery({
    queryKey: ['global-admin-check'],
    queryFn: () => apiJson('/global-admin/dashboard'),
    enabled: Boolean(accessToken),
    retry: false,
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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    }
    if (notifOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

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

  const unread = unreadQ.data?.count ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-indigo-50/40">
      <header className="border-b border-white/60 bg-white/70 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4 py-4">
            <Link to="/app" className="text-sm font-bold tracking-wide text-slate-900">
              MIRAI Tasker
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-3 text-sm font-medium text-slate-700" aria-label="Main">
              <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app">
                Projects
              </Link>
              <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/my-work">
                My work
              </Link>
              <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/employees">
                Team
              </Link>
              <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/billing">
                Billing
              </Link>
              {meShell.data?.membership.role === 'ADMIN' && (
                <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/org-settings">
                  Organization
                </Link>
              )}
              {globalAdmin.isSuccess && (
                <>
                  <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/admin-portal/dashboard">
                    Admin Dashboard
                  </Link>
                  <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/admin-portal/users">
                    Admin Users
                  </Link>
                  <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/admin-portal/subscriptions">
                    Admin Subs
                  </Link>
                </>
              )}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  className="relative rounded-lg px-2 py-1 hover:bg-white/60"
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((o) => !o)}
                >
                  <span className="text-base" aria-hidden>
                    🔔
                  </span>
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                      <span className="text-xs font-bold uppercase text-slate-600">Notifications</span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-700 hover:underline"
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifQ.isLoading && <p className="p-3 text-xs text-slate-600">Loading…</p>}
                      {(notifQ.data?.notifications ?? []).length === 0 && !notifQ.isLoading && (
                        <p className="p-3 text-xs text-slate-600">No notifications yet.</p>
                      )}
                      {(notifQ.data?.notifications ?? []).map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-slate-50 px-3 py-2 text-xs ${n.readAt ? 'opacity-70' : 'bg-indigo-50/40'}`}
                        >
                          <div className="font-semibold text-slate-900">{n.title}</div>
                          {n.body && <p className="mt-0.5 text-slate-600">{n.body}</p>}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                            {!n.readAt && (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-indigo-700 hover:underline"
                                onClick={() => markRead.mutate(n.id)}
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Link className="rounded-lg px-2 py-1 hover:bg-white/60" to="/app/profile">
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg px-2 py-1 text-rose-700 hover:bg-rose-50"
              >
                Sign out
              </button>
            </nav>

            {/* Mobile Header Controls */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  className="relative rounded-lg px-2 py-1 hover:bg-slate-100"
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((o) => !o)}
                >
                  <span className="text-base" aria-hidden>
                    🔔
                  </span>
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                      <span className="text-xs font-bold uppercase text-slate-600">Notifications</span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-700 hover:underline"
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                      >
                        Mark all
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifQ.isLoading && <p className="p-3 text-xs text-slate-600">Loading…</p>}
                      {(notifQ.data?.notifications ?? []).length === 0 && !notifQ.isLoading && (
                        <p className="p-3 text-xs text-slate-600">No notifications yet.</p>
                      )}
                      {(notifQ.data?.notifications ?? []).map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-slate-50 px-3 py-2 text-xs ${n.readAt ? 'opacity-70' : 'bg-indigo-50/40'}`}
                        >
                          <div className="font-semibold text-slate-900">{n.title}</div>
                          {n.body && <p className="mt-0.5 text-slate-600">{n.body}</p>}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</span>
                            {!n.readAt && (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-indigo-700 hover:underline"
                                onClick={() => markRead.mutate(n.id)}
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMenuOpen && (
            <nav className="flex flex-col gap-1 border-t border-slate-100 py-3 md:hidden text-sm font-medium text-slate-700" aria-label="Mobile navigation">
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app">
                Projects
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/my-work">
                My work
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/employees">
                Team
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/billing">
                Billing
              </Link>
              {meShell.data?.membership.role === 'ADMIN' && (
                <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/org-settings">
                  Organization
                </Link>
              )}
              {globalAdmin.isSuccess && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <Link className="rounded-lg px-3 py-2 hover:bg-slate-100 font-semibold" to="/app/admin-portal/dashboard">
                    Admin Dashboard
                  </Link>
                  <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/admin-portal/users">
                    Admin Users
                  </Link>
                  <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/admin-portal/subscriptions">
                    Admin Subs
                  </Link>
                </>
              )}
              <div className="my-1 border-t border-slate-100" />
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" to="/app/profile">
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-left rounded-lg px-3 py-2 text-rose-700 hover:bg-rose-50"
              >
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>
      <a
        href="#app-main-content"
        className="fixed left-3 top-3 z-[200] -translate-y-24 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        Skip to main content
      </a>
      <main id="app-main-content" className="mx-auto max-w-6xl px-6 py-10" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
