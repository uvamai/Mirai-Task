import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useRecentNavigation } from '../../hooks/useRecentNavigation';
import { boardShellAppPath } from '../../hooks/useBoardShellView';
import { menuBelowTrigger } from './floatingMenuGeometry';

export type BoardOption = { id: string; name: string };

/**
 * M8 — Board quick switcher. Replaces the native `<select>` in the project
 * header so we can:
 *  - soft-navigate via React Router (preserve client state, no full reload),
 *  - record the visit into the Cmd/Ctrl+K palette's recent list,
 *  - expose a "+ New board" action inline (Manager/Admin only),
 *  - keep full keyboard control (↑/↓/Enter/Esc).
 */
export function BoardSwitcher({
  projectId,
  projectName,
  activeBoardId,
  boards,
  canManage,
  onCreateBoard,
}: {
  projectId: string;
  projectName: string;
  activeBoardId: string | undefined;
  boards: BoardOption[];
  canManage: boolean;
  onCreateBoard: () => void;
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<CSSProperties | null>(null);
  const { push: pushRecent } = useRecentNavigation();

  /** Pre-select the active board's index when the menu opens. */
  useEffect(() => {
    if (!open) return;
    const idx = boards.findIndex((b) => b.id === activeBoardId);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, activeBoardId, boards]);

  useFocusTrap(menuRef, open);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    const sync = () => {
      if (!buttonRef.current) return;
      setMenuBox(menuBelowTrigger(buttonRef.current, { minWidth: 260, maxWidth: 360 }));
    };
    sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', sync, true);
    };
  }, [open]);

  /** Close on outside click (menu is portaled outside `rootRef`). */
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  /** Close on Escape from anywhere inside the menu. */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const activeName = activeBoard?.name ?? boards[0]?.name ?? 'Board';

  function go(b: BoardOption) {
    const to = boardShellAppPath(projectId, b.id);
    pushRecent({
      key: `b:${b.id}`,
      label: `${projectName} · ${b.name}`,
      to,
      hint: 'Board',
    });
    setOpen(false);
    nav(to);
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const last = boards.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(last, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      const target = boards[activeIndex];
      if (target) {
        e.preventDefault();
        go(target);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch board"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-white"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Board</span>
        <span className="max-w-[200px] truncate" title={activeName}>
          {activeName}
        </span>
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        menuBox &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Boards in this project"
            tabIndex={-1}
            onKeyDown={onMenuKey}
            style={menuBox}
            className="rounded-2xl border border-white/60 bg-white p-1.5 shadow-2xl ring-1 ring-slate-200/60"
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Boards · {boards.length}
            </div>
            <ul>
              {boards.map((b, idx) => {
                const isActive = b.id === activeBoardId;
                const isCursor = idx === activeIndex;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(b)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                        isCursor ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate" title={b.name}>
                        {b.name}
                      </span>
                      {isActive && (
                        <span
                          className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            isCursor ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          Active
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {boards.length === 0 && (
                <li className="px-3 py-3 text-xs text-slate-500">No boards yet.</li>
              )}
            </ul>
            {canManage && (
              <>
                <div className="my-1 h-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreateBoard();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
                >
                  <span className="text-base leading-none">＋</span>
                  New board…
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
