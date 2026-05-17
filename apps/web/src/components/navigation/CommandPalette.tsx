import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../api/client';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useRecentNavigation, type RecentItem } from '../../hooks/useRecentNavigation';
import { boardShellAppPath } from '../../hooks/useBoardShellView';
import {
  Search, Folder, LayoutDashboard, Clock, ChevronRight,
  CheckSquare, Layers, Home, Star,
} from 'lucide-react';

type ProjectRow = { id: string; name: string; boards?: { id: string; name: string }[] };
type MyWorkRow = { id: string; key: string; title: string; status: string; priority: string; projectId: string; boardId: string; projectName: string };

type Item = {
  key: string;
  label: string;
  hint?: string;
  sub?: string;
  to: string;
  group?: 'recent' | 'projects' | 'boards' | 'tasks' | 'pages';
  icon?: React.ReactNode;
};

const prioColors: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-amber-100 text-amber-700',
  P3: 'bg-blue-100 text-blue-700',
  P4: 'bg-slate-100 text-slate-500',
};

const GROUP_META: Record<string, { label: string; icon: React.ReactNode }> = {
  recent: { label: 'Recent', icon: <Clock size={11} /> },
  pages: { label: 'Navigation', icon: <Home size={11} /> },
  projects: { label: 'Projects', icon: <Folder size={11} /> },
  boards: { label: 'Boards', icon: <Layers size={11} /> },
  tasks: { label: 'My Tasks', icon: <CheckSquare size={11} /> },
};

const STATIC_PAGES: Item[] = [
  { key: 'nav:home', label: 'Home — Command Centre', hint: '/app', to: '/app', group: 'pages', icon: <Home size={14} className="text-indigo-500" /> },
  { key: 'nav:my-work', label: 'My Tasks', hint: '/app/my-work', to: '/app/my-work', group: 'pages', icon: <CheckSquare size={14} className="text-emerald-500" /> },
  { key: 'nav:employees', label: 'Team Members', hint: '/app/employees', to: '/app/employees', group: 'pages', icon: <LayoutDashboard size={14} className="text-blue-500" /> },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const [q, setQ] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { items: recents, push: pushRecent } = useRecentNavigation();

  useFocusTrap(dialogRef, open);

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
    enabled: open,
  });

  const myWorkQ = useQuery({
    queryKey: ['my-work'],
    queryFn: () => apiJson<{ tasks: MyWorkRow[] }>('/tasks/my-work'),
    enabled: open,
  });

  const all = useMemo(() => {
    const out: Item[] = [...STATIC_PAGES];
    for (const p of projectsQ.data?.projects ?? []) {
      out.push({
        key: `p:${p.id}`,
        label: p.name,
        hint: 'Project',
        to: `/app/projects/${p.id}`,
        group: 'projects',
        icon: <Folder size={14} className="text-indigo-400" />,
      });
      for (const b of p.boards ?? []) {
        out.push({
          key: `b:${b.id}`,
          label: b.name,
          sub: p.name,
          hint: 'Board',
          to: boardShellAppPath(p.id, b.id),
          group: 'boards',
          icon: <Layers size={14} className="text-violet-400" />,
        });
      }
    }
    for (const t of myWorkQ.data?.tasks ?? []) {
      out.push({
        key: `t:${t.id}`,
        label: t.title,
        sub: `${t.key} · ${t.projectName}`,
        hint: t.priority,
        to: boardShellAppPath(t.projectId, t.boardId),
        group: 'tasks',
        icon: <CheckSquare size={14} className="text-emerald-500" />,
      });
    }
    return out;
  }, [projectsQ.data, myWorkQ.data]);

  const filtered = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      const recentItems: Item[] = recents.map((r) => ({
        key: `r:${r.key}`,
        label: r.label,
        hint: r.hint ?? 'Recent',
        to: r.to,
        group: 'recent',
        icon: <Star size={14} className="text-amber-400" />,
      }));
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const deduped = recentItems.filter((r) => r.to !== currentPath);
      return [...deduped, ...STATIC_PAGES, ...(projectsQ.data?.projects ?? []).slice(0, 5).map(p => ({
        key: `p:${p.id}`,
        label: p.name,
        hint: 'Project',
        to: `/app/projects/${p.id}`,
        group: 'projects' as const,
        icon: <Folder size={14} className="text-indigo-400" />,
      }))].slice(0, 18);
    }
    return all
      .filter((i) =>
        i.label.toLowerCase().includes(needle) ||
        (i.sub ?? '').toLowerCase().includes(needle) ||
        (i.hint ?? '').toLowerCase().includes(needle)
      )
      .slice(0, 18);
  }, [all, q, recents, projectsQ.data]);

  useEffect(() => { setActiveIndex(0); }, [q, open]);
  useEffect(() => { activeRowRef.current?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);
  // Reset query when closed
  useEffect(() => { if (!open) setQ(''); }, [open]);

  function commit(item: Item) {
    if (!item.key.startsWith('nav:')) {
      pushRecent({
        key: item.key.replace(/^r:/, ''),
        label: item.label,
        to: item.to,
        hint: item.group === 'recent' ? 'Recent' : item.hint,
      } satisfies Omit<RecentItem, 'at'>);
    }
    onClose();
    nav(item.to);
  }

  if (!open) return null;

  const showGroupHeaders = true;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-[2px]"
        role="presentation"
        onMouseDown={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="fixed left-1/2 top-[10vh] z-[130] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2"
        style={{ animation: 'fadeInUp 0.18s ease both' }}
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(filtered.length - 1, i + 1)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); return; }
                if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); return; }
                if (e.key === 'End') { e.preventDefault(); setActiveIndex(Math.max(0, filtered.length - 1)); return; }
                if (e.key === 'Enter') {
                  const target = filtered[activeIndex];
                  if (target) { e.preventDefault(); commit(target); }
                }
              }}
              placeholder="Search projects, boards, my tasks…"
              className="flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
            <kbd className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="custom-scrollbar max-h-[60vh] overflow-y-auto py-2">
            {(projectsQ.isLoading || myWorkQ.isLoading) && (
              <div className="px-4 py-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}
              </div>
            )}
            {!projectsQ.isLoading && !myWorkQ.isLoading &&
              filtered.map((item, idx) => {
                const prev = filtered[idx - 1];
                const showHeader = showGroupHeaders && (idx === 0 || prev?.group !== item.group);
                const isActive = idx === activeIndex;
                const gm = GROUP_META[item.group ?? 'projects'];
                return (
                  <div key={item.key}>
                    {showHeader && (
                      <div className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {gm?.icon} {gm?.label}
                      </div>
                    )}
                    <button
                      ref={idx === activeIndex ? activeRowRef : undefined}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => commit(item)}
                      aria-selected={isActive}
                      className={`flex w-full items-center gap-3 rounded-xl mx-2 px-3 py-2.5 text-left text-sm transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-800 hover:bg-slate-50'
                      }`}
                      style={{ width: 'calc(100% - 16px)' }}
                    >
                      {item.icon && (
                        <span className={`shrink-0 ${isActive ? 'opacity-90' : ''}`}>{item.icon}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.label}</span>
                        {item.sub && (
                          <span className={`block truncate text-[11px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {item.sub}
                          </span>
                        )}
                      </span>
                      {item.hint && item.group === 'tasks' && (
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-white/20 text-white' : (prioColors[item.hint] ?? 'bg-slate-100 text-slate-500')
                        }`}>
                          {item.hint}
                        </span>
                      )}
                      {item.group !== 'tasks' && item.hint && (
                        <span className={`shrink-0 flex items-center gap-1 text-[11px] font-medium ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {item.hint} <ChevronRight size={11} />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            {!projectsQ.isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center text-sm text-slate-500">
                <Search size={28} className="text-slate-200 mb-2" />
                No results for "{q}"
              </div>
            )}
          </div>

          {/* Footer hint bar */}
          <div className="flex items-center justify-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2">
            {[
              { keys: ['↑', '↓'], label: 'navigate' },
              { keys: ['↵'], label: 'open' },
              { keys: ['Esc'], label: 'close' },
            ].map(({ keys, label }) => (
              <span key={label} className="flex items-center gap-1 text-[11px] text-slate-400">
                {keys.map(k => <kbd key={k} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold shadow-sm">{k}</kbd>)}
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
