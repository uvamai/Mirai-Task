import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../../api/client';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useRecentNavigation, type RecentItem } from '../../hooks/useRecentNavigation';
import { boardShellAppPath } from '../../hooks/useBoardShellView';

type ProjectRow = { id: string; name: string; boards?: { id: string; name: string }[] };

type Item = {
  key: string;
  label: string;
  hint?: string;
  to: string;
  /** Used for the "Recent" group divider; not rendered on each row. */
  group?: 'recent' | 'projects' | 'boards';
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

  /**
   * Build the candidate list. When the search box is empty we show the recent
   * navigation history (last 8) first so users can hop back fast; otherwise we
   * fall back to the full project/board fuzzy list as before.
   */
  const all = useMemo(() => {
    const out: Item[] = [];
    /** Always include "Home" as a stable first entry; it never appears in recents. */
    out.push({ key: 'home', label: 'Projects (home)', hint: '/app', to: '/app', group: 'projects' });
    for (const p of projectsQ.data?.projects ?? []) {
      out.push({
        key: `p:${p.id}`,
        label: p.name,
        hint: 'Project',
        to: `/app/projects/${p.id}`,
        group: 'projects',
      });
      for (const b of p.boards ?? []) {
        out.push({
          key: `b:${b.id}`,
          label: `${p.name} · ${b.name}`,
          hint: 'Board',
          to: boardShellAppPath(p.id, b.id),
          group: 'boards',
        });
      }
    }
    return out;
  }, [projectsQ.data]);

  const filtered = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      const recentItems: Item[] = recents.map((r) => ({
        key: `r:${r.key}`,
        label: r.label,
        hint: r.hint ?? 'Recent',
        to: r.to,
        group: 'recent',
      }));
      /** Filter out current page from recents (don't navigate to self). */
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const recentDeduped = recentItems.filter((r) => r.to !== currentPath);
      return [...recentDeduped, ...all].slice(0, 18);
    }
    return all
      .filter((i) => i.label.toLowerCase().includes(needle) || (i.hint ?? '').toLowerCase().includes(needle))
      .slice(0, 18);
  }, [all, q, recents]);

  /** Reset cursor when the visible set changes. */
  useEffect(() => {
    setActiveIndex(0);
  }, [q, open]);

  /** Keep the active row in view as the user arrows down through results. */
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function commit(item: Item) {
    /** Record into recents (skip the synthetic 'home' entry). */
    if (item.key !== 'home') {
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

  /** Grouped section labels keep the empty-state palette scannable. */
  const showGroupHeaders = q.trim() === '';

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-slate-900/35 backdrop-blur-[1px]"
        role="presentation"
        onMouseDown={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
        tabIndex={-1}
        className="fixed left-1/2 top-[12vh] z-[130] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2"
      >
        <div className="glass-modal-card rounded-2xl p-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/40 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Search</span>
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                  return;
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                  return;
                }
                if (e.key === 'Home') {
                  e.preventDefault();
                  setActiveIndex(0);
                  return;
                }
                if (e.key === 'End') {
                  e.preventDefault();
                  setActiveIndex(Math.max(0, filtered.length - 1));
                  return;
                }
                if (e.key === 'Enter') {
                  const target = filtered[activeIndex];
                  if (target) {
                    e.preventDefault();
                    commit(target);
                  }
                }
              }}
              placeholder="Jump to project / board — try a name, ↑/↓ to navigate"
              className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500"
            />
            <span className="rounded-lg bg-white/60 px-2 py-1 text-[10px] font-bold text-slate-600">Esc</span>
          </div>

          <div className="custom-scrollbar mt-2 max-h-[56vh] overflow-y-auto">
            {projectsQ.isLoading && <p className="px-3 py-3 text-sm text-slate-600">Loading…</p>}
            {projectsQ.isError && <p className="px-3 py-3 text-sm text-rose-700">Could not load projects.</p>}
            {!projectsQ.isLoading &&
              filtered.map((i, idx) => {
                const prev = filtered[idx - 1];
                const showHeader = showGroupHeaders && (idx === 0 || prev?.group !== i.group);
                return (
                  <div key={i.key}>
                    {showHeader && (
                      <div className="mt-2 px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {i.group === 'recent' ? 'Recent' : i.group === 'boards' ? 'Boards' : 'Projects'}
                      </div>
                    )}
                    <button
                      ref={idx === activeIndex ? activeRowRef : undefined}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => commit(i)}
                      aria-selected={idx === activeIndex}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        idx === activeIndex
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-800 hover:bg-white/55'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      {i.hint && (
                        <span
                          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            idx === activeIndex ? 'bg-white/25 text-white' : 'bg-white/60 text-slate-600'
                          }`}
                        >
                          {i.hint}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            {!projectsQ.isLoading && filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-600">No matches.</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-600">
          <span className="rounded bg-white/60 px-1.5 py-0.5">↑</span>
          <span className="rounded bg-white/60 px-1.5 py-0.5">↓</span> navigate ·{' '}
          <span className="rounded bg-white/60 px-1.5 py-0.5">Enter</span> open ·{' '}
          <span className="rounded bg-white/60 px-1.5 py-0.5">Esc</span> close · open anywhere with{' '}
          <span className="rounded bg-white/60 px-1.5 py-0.5">Ctrl</span>+
          <span className="rounded bg-white/60 px-1.5 py-0.5">K</span> (
          <span className="rounded bg-white/60 px-1.5 py-0.5">⌘</span>+
          <span className="rounded bg-white/60 px-1.5 py-0.5">K</span> on macOS)
        </p>
      </div>
    </>
  );
}
