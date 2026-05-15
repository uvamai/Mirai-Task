import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  PRIORITY_LEVELS,
  type SavedView,
  type SavedViewFilters,
  type TaskPriority,
} from '../../hooks/useSavedViews';
import {
  BOARD_CARD_FIELD_KEYS,
  BOARD_CARD_LABELS,
  LIST_COLUMN_KEYS,
  LIST_COLUMN_LABELS,
  type BoardCardFieldKey,
  type ListColumnKey,
} from '../../hooks/useViewColumnPrefs';
import { menuBelowTrigger } from '../project/floatingMenuGeometry';

type Props = {
  canManageBoard: boolean;
  isAdmin: boolean;
  canCreate: boolean;
  /** When false, hides density + kanban column/template controls (list view toolbar). */
  showBoardChrome?: boolean;
  /** Shown above the description line (e.g. "Board" / "List"). */
  surfaceLabel?: string;
  density: 'comfortable' | 'dense';
  onDensity: (d: 'comfortable' | 'dense') => void;
  onEditColumns: () => void;
  onSaveTemplate: () => void;
  onNewTask: () => void;
  /** Saved-views v1 (M10). */
  filters: SavedViewFilters;
  onFilters: (next: SavedViewFilters) => void;
  views: SavedView[];
  activeViewId: string | null;
  onApplyView: (view: SavedView | null) => void;
  onSaveView: (name: string) => void;
  onDeleteView: (id: string) => void;
  /** Allow saving a named view when filters and/or column layout differ from defaults. */
  canSaveView?: boolean;
  /** PM3: opens the Fields drawer (list + board visibility). */
  onOpenFieldsPanel?: () => void;
  fieldToggleSurface?: 'board' | 'list' | null;
  listColumnVisibility?: Record<ListColumnKey, boolean>;
  onToggleListColumn?: (k: ListColumnKey) => void;
  boardCardVisibility?: Record<BoardCardFieldKey, boolean>;
  onToggleBoardCard?: (k: BoardCardFieldKey) => void;
};

export function BoardToolbar({
  canManageBoard,
  isAdmin,
  canCreate,
  showBoardChrome = true,
  surfaceLabel = 'Board',
  density,
  onDensity,
  onEditColumns,
  onSaveTemplate,
  onNewTask,
  filters,
  onFilters,
  views,
  activeViewId,
  onApplyView,
  onSaveView,
  onDeleteView,
  canSaveView: canSaveViewProp,
  onOpenFieldsPanel,
  fieldToggleSurface = null,
  listColumnVisibility,
  onToggleListColumn,
  boardCardVisibility,
  onToggleBoardCard,
}: Props) {
  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewsMenuBox, setViewsMenuBox] = useState<CSSProperties | null>(null);
  const viewsBtnRef = useRef<HTMLButtonElement>(null);
  const viewsMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!viewsOpen) {
      setViewsMenuBox(null);
      return;
    }
    const sync = () => {
      if (!viewsBtnRef.current) return;
      setViewsMenuBox(menuBelowTrigger(viewsBtnRef.current, { minWidth: 288, maxWidth: 288 }));
    };
    sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', sync, true);
    };
  }, [viewsOpen]);

  useEffect(() => {
    if (!viewsOpen) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (viewsBtnRef.current?.contains(t) || viewsMenuRef.current?.contains(t)) return;
      setViewsOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [viewsOpen]);

  function togglePriority(p: TaskPriority) {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p];
    onFilters({ ...filters, priorities: next });
  }

  function clearFilters() {
    onFilters({ search: '', priorities: [] });
    onApplyView(null);
  }

  function handleSaveView() {
    const suggested = filters.search
      ? `Search: ${filters.search.slice(0, 20)}`
      : filters.priorities.length
        ? `${filters.priorities.join(', ')} only`
        : 'Saved view';
    const name = window.prompt('Name this view', suggested);
    if (!name) return;
    onSaveView(name.trim());
    setViewsOpen(false);
  }

  const activeView = views.find((v) => v.id === activeViewId) ?? null;
  const hasFilters = filters.search.length > 0 || filters.priorities.length > 0;
  const canSaveView = canSaveViewProp ?? hasFilters;

  const idleSubtitle =
    surfaceLabel === 'Table'
      ? onOpenFieldsPanel
        ? 'Dense table of tasks (PM9). Filters + saved views match List; use Fields for columns.'
        : 'Dense table of tasks; filters and saved views match List.'
      : surfaceLabel === 'List'
      ? onOpenFieldsPanel
        ? 'Filter tasks; use Fields for list + board visibility. Saved views store filters + column layout.'
        : 'Filter tasks and pick list columns. Saved views store filters + column layout.'
      : onOpenFieldsPanel
        ? 'Drag cards between columns. Drag a column edge to resize. Use Fields to tune card contents.'
        : 'Drag cards between columns. Drag a column edge to resize.';

  return (
    <div className="glass-toolbar sticky top-3 z-10 space-y-2 rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{surfaceLabel}</p>
          <p className="text-sm text-slate-700">
            {activeView ? (
              <>
                Viewing <span className="font-semibold">{activeView.name}</span>
              </>
            ) : (
              idleSubtitle
            )}
          </p>
        </div>
        {showBoardChrome ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                density === 'comfortable' ? 'bg-slate-900 text-white' : 'bg-white/80 text-slate-700 ring-1 ring-slate-200'
              }`}
              onClick={() => onDensity('comfortable')}
            >
              Comfortable
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                density === 'dense' ? 'bg-slate-900 text-white' : 'bg-white/80 text-slate-700 ring-1 ring-slate-200'
              }`}
              onClick={() => onDensity('dense')}
            >
              Dense
            </button>
            {canManageBoard && (
              <button
                type="button"
                onClick={onEditColumns}
                className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-white"
              >
                Edit columns
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={onSaveTemplate}
                className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-100"
              >
                Save template
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={onNewTask}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md"
              >
                New task
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(e) => onFilters({ ...filters, search: e.target.value })}
          placeholder="Search title or key (MIRAI-…)"
          aria-label="Search board"
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-1.5 py-1">
          <span className="px-1 text-[10px] font-bold uppercase text-slate-500">Priority</span>
          {PRIORITY_LEVELS.map((p) => {
            const on = filters.priorities.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                aria-pressed={on}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {onOpenFieldsPanel && (
          <button
            type="button"
            onClick={onOpenFieldsPanel}
            className="rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
            title="Show or hide list columns and board card fields"
          >
            Fields
          </button>
        )}

        <div className="relative">
          <button
            ref={viewsBtnRef}
            type="button"
            onClick={() => setViewsOpen((v) => !v)}
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            aria-haspopup="menu"
            aria-expanded={viewsOpen}
          >
            Views {views.length > 0 && <span className="ml-1 text-slate-400">({views.length})</span>}
          </button>
          {viewsOpen &&
            viewsMenuBox &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={viewsMenuRef}
                role="menu"
                style={viewsMenuBox}
                className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onApplyView(null);
                    setViewsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 ${
                    activeView === null ? 'font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  Default view
                  {activeView === null && <span className="text-xs text-slate-400">active</span>}
                </button>
                {views.length > 0 && <div className="my-1 border-t border-slate-100" />}
                <ul className="max-h-64 overflow-y-auto">
                  {views.map((v) => (
                    <li key={v.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onApplyView(v);
                          setViewsOpen(false);
                        }}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${
                          v.id === activeViewId ? 'font-semibold text-slate-900' : 'text-slate-700'
                        }`}
                        title={`Search: "${v.filters.search}" · Priorities: ${
                          v.filters.priorities.length ? v.filters.priorities.join(',') : 'any'
                        }${v.listColumns || v.boardCardFields ? ' · includes column layout' : ''}`}
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteView(v.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete view ${v.name}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSaveView}
                    disabled={!canSaveView}
                    className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    title={
                      canSaveView
                        ? 'Saves filters and current column/card visibility for this board'
                        : 'Set a filter, search, or change column visibility first'
                    }
                  >
                    Save current as view…
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {fieldToggleSurface === 'board' && boardCardVisibility && onToggleBoardCard && (
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-200/60 pt-2">
          <span className="pr-1 text-[10px] font-bold uppercase text-slate-500">Card fields</span>
          {BOARD_CARD_FIELD_KEYS.map((k) => {
            const on = boardCardVisibility[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onToggleBoardCard(k)}
                aria-pressed={on}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  on ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {BOARD_CARD_LABELS[k]}
              </button>
            );
          })}
        </div>
      )}
      {fieldToggleSurface === 'list' && listColumnVisibility && onToggleListColumn && (
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-200/60 pt-2">
          <span className="pr-1 text-[10px] font-bold uppercase text-slate-500">Columns</span>
          {LIST_COLUMN_KEYS.map((k) => {
            const on = listColumnVisibility[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => onToggleListColumn(k)}
                aria-pressed={on}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  on ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {LIST_COLUMN_LABELS[k]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
