import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  boardId: string | undefined;
};

type ViewDef = {
  id: string;
  label: string;
  hint: string;
  /** 'ready' = navigates; 'soon' = disabled */
  state: 'ready' | 'soon';
  path?: (projectId: string, boardId: string) => string;
};

const VIEWS: ViewDef[] = [
  {
    id: 'list',
    label: 'List',
    hint: 'Grouped rows with columns',
    state: 'ready',
    path: (p, b) => `/app/projects/${p}/boards/${b}/list`,
  },
  {
    id: 'board',
    label: 'Board',
    hint: 'Kanban by status',
    state: 'ready',
    path: (p, b) => `/app/projects/${p}/boards/${b}`,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    hint: 'Due dates on a calendar',
    state: 'ready',
    path: (p, b) => `/app/projects/${p}/boards/${b}/calendar`,
  },
  { id: 'gantt', label: 'Gantt', hint: 'Timeline & dependencies', state: 'soon' },
  {
    id: 'table',
    label: 'Table',
    hint: 'Dense HTML table (same data as List)',
    state: 'ready',
    path: (p, b) => `/app/projects/${p}/boards/${b}/table`,
  },
  { id: 'timeline', label: 'Timeline', hint: 'Schedule across resources', state: 'soon' },
  { id: 'docs', label: 'Docs', hint: 'Wiki & pages', state: 'soon' },
  { id: 'forms', label: 'Forms', hint: 'Intake & surveys', state: 'soon' },
];

export function AddProjectViewModal({ open, onClose, projectId, boardId }: Props) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const node = (
    <>
      <div className="fixed inset-0 z-[115] bg-slate-900/35 backdrop-blur-[1px]" role="presentation" onMouseDown={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Add or switch view"
        tabIndex={-1}
        className="fixed left-1/2 top-[14vh] z-[125] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2"
      >
        <div className="glass-modal-card max-h-[80vh] overflow-y-auto rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Views</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {boardId
                  ? 'Open a saved view type for this board. Gantt and advanced views ship in later phases (PM9+).'
                  : 'Select or create a board first — then you can open List, Board, Calendar, and Table.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VIEWS.map((v) => {
              const disabled = v.state === 'soon' || !boardId;
              const onPick = () => {
                if (disabled || !v.path || !boardId) return;
                onClose();
                nav(v.path(projectId, boardId));
              };
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={onPick}
                    className={`flex w-full flex-col gap-1 rounded-xl border p-3 text-left text-sm shadow-sm transition ${
                      disabled
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50/80 text-slate-400'
                        : 'border-slate-200/80 bg-white/90 font-semibold text-slate-900 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className="text-[11px] font-normal leading-snug text-slate-500">{v.hint}</span>
                    {v.state === 'soon' && (
                      <span className="text-[10px] font-bold uppercase text-amber-700">Coming soon</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
