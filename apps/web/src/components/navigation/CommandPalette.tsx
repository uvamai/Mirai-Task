import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../api/client';

type ProjectRow = { id: string; name: string; boards?: { id: string; name: string }[] };

type Item = {
  key: string;
  label: string;
  hint?: string;
  to: string;
};

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
    enabled: open,
  });

  const items = useMemo(() => {
    const out: Item[] = [{ key: 'home', label: 'Projects', hint: '/app', to: '/app' }];
    for (const p of projectsQ.data?.projects ?? []) {
      out.push({ key: `p:${p.id}`, label: p.name, hint: 'Project', to: `/app/projects/${p.id}` });
      for (const b of p.boards ?? []) {
        out.push({
          key: `b:${b.id}`,
          label: `${p.name} · ${b.name}`,
          hint: 'Board',
          to: `/app/projects/${p.id}/boards/${b.id}`,
        });
      }
    }
    return out;
  }, [projectsQ.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 18);
    return items
      .filter((i) => i.label.toLowerCase().includes(needle) || (i.hint ?? '').toLowerCase().includes(needle))
      .slice(0, 18);
  }, [items, q]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-slate-900/35 backdrop-blur-[1px]"
        role="presentation"
        onMouseDown={onClose}
      />
      <div className="fixed left-1/2 top-[12vh] z-[130] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2">
        <div className="glass-panel rounded-2xl p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/40 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Search</span>
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
                if (e.key === 'Enter') {
                  const first = filtered[0];
                  if (first) {
                    onClose();
                    nav(first.to);
                  }
                }
              }}
              placeholder="Jump to project/board…"
              className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500"
            />
            <span className="rounded-lg bg-white/60 px-2 py-1 text-[10px] font-bold text-slate-600">Esc</span>
          </div>

          <div className="custom-scrollbar mt-2 max-h-[56vh] overflow-y-auto">
            {projectsQ.isLoading && <p className="px-3 py-3 text-sm text-slate-600">Loading…</p>}
            {projectsQ.isError && <p className="px-3 py-3 text-sm text-rose-700">Could not load projects.</p>}
            {!projectsQ.isLoading &&
              filtered.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => {
                    onClose();
                    nav(i.to);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-white/55 active:bg-white/70"
                >
                  <span className="min-w-0 flex-1 truncate">{i.label}</span>
                  {i.hint && (
                    <span className="shrink-0 rounded-lg bg-white/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {i.hint}
                    </span>
                  )}
                </button>
              ))}
            {!projectsQ.isLoading && filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-600">No matches.</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-600">
          Tip: press <span className="rounded bg-white/50 px-1.5 py-0.5">Ctrl</span>+
          <span className="rounded bg-white/50 px-1.5 py-0.5">K</span> (or <span className="rounded bg-white/50 px-1.5 py-0.5">⌘</span>+
          <span className="rounded bg-white/50 px-1.5 py-0.5">K</span>) from anywhere.
        </p>
      </div>
    </>
  );
}

