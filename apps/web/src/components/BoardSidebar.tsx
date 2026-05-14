import { NavLink } from 'react-router-dom';
import { useMemo, useState } from 'react';

export type BoardSidebarBoard = { id: string; name: string };

export function BoardSidebar({
  projectId,
  projectName,
  boards,
  activeBoardId,
  canManage,
  onCreateBoard,
}: {
  projectId: string;
  projectName: string;
  boards: BoardSidebarBoard[];
  activeBoardId?: string;
  canManage: boolean;
  onCreateBoard: () => void;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mirai_board_sidebar_collapsed') === '1');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => b.name.toLowerCase().includes(q));
  }, [boards, query]);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('mirai_board_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }

  return (
    <aside
      className={`h-[calc(100vh-84px)] shrink-0 border-r border-white/40 bg-white/70 backdrop-blur-xl ${
        collapsed ? 'w-[72px]' : 'w-[280px]'
      }`}
      aria-label="Project boards sidebar"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-white/50 px-3 py-3">
          <div className="min-w-0">
            {!collapsed && (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Project</div>
                <div className="truncate text-sm font-bold text-slate-900">{projectName}</div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapse}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white/60"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pt-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Boards</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search boards…"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm"
            />
          </div>
        )}

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-3">
          {filtered.map((b) => (
            <NavLink
              key={b.id}
              to={`/app/projects/${projectId}/boards/${b.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive || b.id === activeBoardId
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`
              }
              title={b.name}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  b.id === activeBoardId ? 'bg-white/15' : 'bg-slate-200 text-slate-700'
                }`}
                aria-hidden
              >
                {b.name.trim().slice(0, 1).toUpperCase()}
              </span>
              {!collapsed && <span className="min-w-0 flex-1 truncate">{b.name}</span>}
            </NavLink>
          ))}
          {filtered.length === 0 && !collapsed && (
            <p className="px-3 py-2 text-xs text-slate-500">No boards match that search.</p>
          )}
        </div>

        {canManage && (
          <div className="border-t border-white/50 p-3">
            <button
              type="button"
              onClick={onCreateBoard}
              className={`w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-md ${
                collapsed ? 'px-2 text-xs' : ''
              }`}
            >
              {collapsed ? '+ Board' : 'Create board'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

