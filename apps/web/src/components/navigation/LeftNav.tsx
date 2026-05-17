import { Link, NavLink, useLocation, matchPath, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { AppLauncherModal } from './AppLauncherModal';
import {
  Home,
  CheckSquare,
  Calendar,
  Sparkles,
  Users,
  Grid,
  ChevronLeft,
  ChevronRight,
  Settings,
  Bell,
  Star,
  FolderOpen,
  ShieldAlert,
  CreditCard,
  Repeat,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../../api/client';

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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mirai_leftnav_collapsed') === '1');
  const [recent, setRecent] = useState<RecentLink[]>(() => loadRecent());
  const [launcherOpen, setLauncherOpen] = useState(false);

  // Fetch projects to populate the "Spaces" section
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: { id: string; name: string }[] }>('/projects'),
  });
  const projects = projectsData?.projects ?? [];

  const activeContext = useMemo(() => {
    const match = matchPath('/app/projects/:projectId/*', loc.pathname);
    const projectId = match?.params.projectId;
    let boardId: string | undefined = undefined;
    if (projectId) {
      const bMatch = matchPath('/app/projects/:projectId/boards/:boardId/*', loc.pathname);
      if (bMatch) boardId = bMatch.params.boardId;
    }
    return { projectId, boardId };
  }, [loc.pathname]);

  useEffect(() => {
    setRecent(loadRecent());
    setLauncherOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('mirai_leftnav_collapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <aside className="flex h-screen shrink-0" aria-label="Primary navigation">
      <AppLauncherModal open={launcherOpen} onClose={() => setLauncherOpen(false)} isAdmin={isAdmin} />

      {/* Global Nav (Extreme Left) */}
      <div className="flex w-[68px] flex-col items-center bg-slate-900 py-3 text-slate-400">
        <Link to="/app" className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-lg">
          M
        </Link>
        <div className="flex flex-1 flex-col items-center gap-3 w-full px-2">
          <GlobalNavItem to="/app" icon={<Home size={22} />} label="Home" isActive={loc.pathname === '/app'} />
          <GlobalNavItem to="/app/my-work" icon={<CheckSquare size={22} />} label="Tasks" isActive={loc.pathname === '/app/my-work'} />
          <GlobalNavItem to="/app/notifications" icon={<Bell size={22} />} label="Inbox" isActive={loc.pathname === '/app/notifications'} />
          <GlobalNavItem to="/app/calendar" icon={<Calendar size={22} />} label="Planner" isActive={loc.pathname === '/app/calendar'} />
          <GlobalNavItem to="/app/ai" icon={<Sparkles size={22} />} label="AI" isActive={loc.pathname === '/app/ai'} />
          <GlobalNavItem to="/app/employees" icon={<Users size={22} />} label="Team" isActive={loc.pathname === '/app/employees'} />
          <button onClick={() => setLauncherOpen(true)} className="flex w-full flex-col items-center gap-1 rounded-xl p-2 hover:bg-slate-800 hover:text-white transition group text-[10px] font-medium mt-auto mb-2">
            <Grid size={22} className="group-hover:scale-110 transition-transform" />
            <span>More</span>
          </button>
        </div>
      </div>

      {/* Secondary Nav (Workspace/Spaces) */}
      <div className={`flex flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300 ease-in-out ${collapsed ? 'w-0 overflow-hidden border-none' : 'w-[250px]'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800 truncate">{tenantName}</div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Workspace</div>
          </div>
          <button onClick={toggleCollapse} className="text-slate-400 hover:text-slate-600 ml-2">
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-2 flex flex-col gap-1">
          {/* Main Links */}
          <SpaceNavItem to="/app" icon={<Home size={16} />} label="Home" />
          <SpaceNavItem to="/app/notifications" icon={<Bell size={16} />} label="Inbox" />
          <SpaceNavItem to="/app/my-work" icon={<CheckSquare size={16} />} label="My Tasks" />

          {/* Spaces / Projects */}
          <div className="mt-4 px-2 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Projects</span>
            <button onClick={() => setLauncherOpen(true)} className="hover:text-indigo-600 transition" title="New Project">+</button>
          </div>
          {projects.slice(0, 8).map(p => {
            const isActiveProject = activeContext.projectId === p.id;
            return (
              <div key={p.id} className="flex flex-col gap-0.5">
                <SpaceNavItem to={`/app/projects/${p.id}`} icon={<FolderOpen size={16} />} label={p.name} />
                {isActiveProject && activeContext.boardId && !collapsed && (
                  <div className="ml-6 pl-2 border-l border-slate-200 py-1 flex flex-col gap-0.5">
                    <button onClick={() => navigate(`${loc.pathname}?search=1`)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition text-left" title="Filter tasks in this board">
                      <Search size={14} /> Filters
                    </button>
                    <button onClick={() => navigate(`${loc.pathname}?recurring=1`)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition text-left" title="Manage recurring tasks">
                      <Repeat size={14} /> Recurring Tasks
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Admin Links */}
          {(isAdmin || isGlobalAdmin) && (
            <div className="mt-6 px-2 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              Admin & Settings
            </div>
          )}
          {isAdmin && (
            <>
              <SpaceNavItem to="/app/org-settings" icon={<Settings size={16} />} label="Organization" />
              <SpaceNavItem to="/app/integrations" icon={<Sparkles size={16} />} label="Integrations & AI" />
              <SpaceNavItem to="/app/billing" icon={<CreditCard size={16} />} label="Billing" />
            </>
          )}
          {isGlobalAdmin && (
            <>
              <SpaceNavItem to="/app/admin-portal/dashboard" icon={<ShieldAlert size={16} />} label="Admin Dashboard" />
              <SpaceNavItem to="/app/admin-portal/users" icon={<Users size={16} />} label="Admin Users" />
            </>
          )}

          {/* Recent */}
          <div className="mt-6 px-2 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Favorites & Recent
          </div>
          {recent.map((r) => (
            <SpaceNavItem key={r.to} to={r.to} icon={<Star size={16} className="text-amber-400" />} label={r.label} />
          ))}
          {recent.length === 0 && <div className="px-3 py-1 text-xs text-slate-400 italic">No recents yet</div>}
        </div>
      </div>

      {/* Expand Button if collapsed */}
      {collapsed && (
        <button 
          onClick={toggleCollapse} 
          className="absolute left-[68px] top-4 z-50 flex h-8 w-8 items-center justify-center rounded-r-xl bg-white border border-l-0 border-slate-200 text-slate-500 shadow-sm hover:text-indigo-600 hover:bg-slate-50"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </aside>
  );
}

function GlobalNavItem({ to, icon, label, isActive }: { to: string; icon: React.ReactNode; label: string; isActive: boolean }) {
  return (
    <NavLink to={to} className={`flex w-full flex-col items-center gap-1 rounded-xl p-2 transition group text-[10px] font-medium ${isActive ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-slate-800 hover:text-white'}`}>
      <div className={`${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'} transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SpaceNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => 
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
      title={label}
    >
      <span className="opacity-70">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}
