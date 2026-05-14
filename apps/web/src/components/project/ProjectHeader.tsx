import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const FAV_KEY = 'mirai_favorite_project_ids';

function loadFavoriteSet(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function persistFavoriteSet(ids: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...ids]));
}

export function ProjectHeader({
  workspaceName,
  projectId,
  projectName,
  activeBoardId,
  isAdmin,
}: {
  workspaceName: string;
  projectId: string;
  projectName: string;
  activeBoardId?: string;
  isAdmin: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavoriteSet());
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(menuRef, menuOpen);

  const isFavorite = favorites.has(projectId);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !menuBtnRef.current?.contains(t)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const projectUrl = useMemo(() => `${window.location.origin}/app/projects/${projectId}`, [projectId]);

  function toggleFavorite() {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      persistFavoriteSet(next);
      return next;
    });
  }

  const reportsTo =
    activeBoardId && projectId
      ? `/app/projects/${projectId}/reports?boardId=${encodeURIComponent(activeBoardId)}`
      : `/app/projects/${projectId}/reports`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link to="/app" className="text-xs font-semibold text-indigo-700">
          ← Projects
        </Link>
        <nav className="mt-1 text-[11px] font-medium text-slate-500" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            <li className="truncate">{workspaceName}</li>
            <li aria-hidden>/</li>
            <li className="truncate font-semibold text-slate-800">{projectName}</li>
          </ol>
        </nav>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{projectName}</h1>
        </div>
      </div>
      <div className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleFavorite}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            isFavorite
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
          }`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove project from favorites' : 'Add project to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <button
          ref={menuBtnRef}
          type="button"
          className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={() => setMenuOpen((o) => !o)}
        >
          •••
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 top-[calc(100%+0.35rem)] z-50 min-w-[220px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                void navigator.clipboard.writeText(projectUrl).catch(() => undefined);
                setMenuOpen(false);
              }}
            >
              Copy project link
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => {
                window.open(projectUrl, '_blank', 'noopener,noreferrer');
                setMenuOpen(false);
              }}
            >
              Open project in new tab
            </button>
            <div className="my-1 h-px bg-slate-100" />
            <Link
              role="menuitem"
              to={`/app/projects/${projectId}/team`}
              className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Team
            </Link>
            <Link
              role="menuitem"
              to={reportsTo}
              className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Reports
            </Link>
            <Link
              role="menuitem"
              to={`/app/projects/${projectId}/automations`}
              className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              Automations
            </Link>
            {isAdmin && (
              <Link
                role="menuitem"
                to={`/app/projects/${projectId}/settings`}
                className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                Intake settings
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
