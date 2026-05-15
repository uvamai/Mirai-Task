import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AppLauncherModal } from './AppLauncherModal';

type RecentLink = { label: string; to: string; at: number };

function loadRecent(): RecentLink[] {
  try {
    const raw = localStorage.getItem('mirai_recent_links');
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
      .map((o) => ({
        label: typeof o.label === 'string' ? o.label : '',
        to: typeof o.to === 'string' ? o.to : '',
        at: typeof o.at === 'number' ? o.at : 0,
      }))
      .filter((x) => x.label && x.to)
      .sort((a, b) => b.at - a.at)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function LeftNav({
  tenantName,
  isAdmin,
  isGlobalAdmin,
  onCollapseChange,
}: {
  tenantName: string;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}) {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mirai_leftnav_collapsed') === '1');
  const [recent, setRecent] = useState<RecentLink[]>(() => loadRecent());
  const [launcherOpen, setLauncherOpen] = useState(false);

  useEffect(() => {
    setRecent(loadRecent());
    setLauncherOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const nav = useMemo(() => {
    const list = [
      { label: 'For you', to: '/app/my-work' },
      { label: 'Projects', to: '/app' },
      { label: 'Team', to: '/app/employees' },
    ];
    if (isAdmin) {
      list.push({ label: 'Billing', to: '/app/billing' });
    }
    return list;
  }, [isAdmin]);

  return (
    <aside
      className={`glass-sidebar sticky top-0 h-screen shrink-0 ${
        collapsed ? 'w-[72px]' : 'w-[268px]'
      }`}
      aria-label="Primary navigation"
    >
      <AppLauncherModal open={launcherOpen} onClose={() => setLauncherOpen(false)} isAdmin={isAdmin} />
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-3">
          <Link to="/app" className="min-w-0">
            {!collapsed ? (
              <>
                <div className="text-xs font-bold tracking-wide text-zinc-900">MIRAI BOARDS</div>
                <div className="truncate text-[11px] font-medium text-zinc-500">{tenantName}</div>
              </>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-900">
                M
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() =>
              setCollapsed((c) => {
                const next = !c;
                localStorage.setItem('mirai_leftnav_collapsed', next ? '1' : '0');
                return next;
              })
            }
            className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="p-2" aria-label="Main sections">
          {nav.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`
              }
              title={i.label}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  loc.pathname === i.to ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-100 text-zinc-600'
                }`}
                aria-hidden
              >
                {i.label.slice(0, 1)}
              </span>
              {!collapsed && <span className="truncate">{i.label}</span>}
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/app/org-settings"
              className={({ isActive }) =>
                `mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`
              }
              title="Organization"
            >
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600 border border-indigo-100"
                aria-hidden
              >
                O
              </span>
              {!collapsed && <span className="truncate">Organization</span>}
            </NavLink>
          )}

          {isGlobalAdmin && (
            <div className={collapsed ? 'mt-2' : 'mt-3'}>
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Admin
                </div>
              )}
              {[
                { label: 'Admin dashboard', to: '/app/admin-portal/dashboard' },
                { label: 'Admin users', to: '/app/admin-portal/users' },
                { label: 'Admin subscriptions', to: '/app/admin-portal/subscriptions' },
              ].map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`
                  }
                  title={i.label}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                      loc.pathname === i.to ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-100 text-zinc-600'
                    }`}
                    aria-hidden
                  >
                    A
                  </span>
                  {!collapsed && <span className="truncate">{i.label}</span>}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => setLauncherOpen(true)}
            className={`flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 ${
              collapsed ? 'justify-center px-2' : ''
            }`}
            title="All apps"
            aria-label="Open apps launcher"
          >
            <span className="text-base" aria-hidden>
              ⧉
            </span>
            {!collapsed && <span>All apps</span>}
          </button>
        </div>

        <div className="custom-scrollbar mt-2 flex-1 overflow-y-auto px-2 pb-3">
          {!collapsed && (
            <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">Recent</div>
          )}
          {recent.map((r) => (
            <NavLink
              key={r.to}
              to={r.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`
              }
              title={r.label}
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-xs font-bold text-zinc-600 border border-zinc-200" aria-hidden>
                {r.label.trim().slice(0, 1).toUpperCase()}
              </span>
              {!collapsed && <span className="min-w-0 flex-1 truncate">{r.label}</span>}
            </NavLink>
          ))}
          {recent.length === 0 && !collapsed && <p className="px-3 py-2 text-xs text-zinc-400">No recent items yet.</p>}
        </div>

        {!collapsed && (
          <div className="border-t border-zinc-100 p-3">
            <p className="text-[11px] text-zinc-400">
              Tip: open a board to populate Recents.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

