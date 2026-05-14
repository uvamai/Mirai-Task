import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  BOARD_CARD_FIELD_KEYS,
  BOARD_CARD_LABELS,
  LIST_COLUMN_KEYS,
  LIST_COLUMN_LABELS,
  type BoardCardFieldKey,
  type ListColumnKey,
} from '../../hooks/useViewColumnPrefs';

const LIST_HINTS: Record<ListColumnKey, string> = {
  key: 'Board-scoped task key (e.g. MIRAI-42).',
  title: 'Primary task title.',
  status: 'Workflow column name — matches this board’s kanban stages.',
  priority: 'P0–P4 priority label.',
  dueDate: 'Due date when set.',
  tags: 'Tag chips when present.',
  deps: 'Count of dependency links.',
};

const BOARD_HINTS: Record<BoardCardFieldKey, string> = {
  key: 'Task key on the card.',
  priority: 'Priority badge.',
  estimate: 'Estimate using this board’s mode (points or hours).',
  tags: 'Up to two tags plus overflow.',
  assignee: 'Assignee initials / placeholder.',
  sla: 'SLA timer when policy applies.',
  deps: 'Dependency count badge.',
  dueDate: 'Due date line on the card.',
};

type FieldsPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Scroll / label context: workflow column names (kanban stages). */
  workflowStages?: string[];
  list: Record<ListColumnKey, boolean>;
  board: Record<BoardCardFieldKey, boolean>;
  onToggleList: (k: ListColumnKey) => void;
  onToggleBoard: (k: BoardCardFieldKey) => void;
  onResetDefaults: () => void;
  /** Which section is shown first (both sections always visible). */
  emphasis?: 'list' | 'board';
};

export function FieldsPanel({
  open,
  onClose,
  workflowStages,
  list,
  board,
  onToggleList,
  onToggleBoard,
  onResetDefaults,
  emphasis = 'board',
}: FieldsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stagesLine =
    workflowStages && workflowStages.length > 0
      ? workflowStages.join(' · ')
      : 'Board workflow stages apply to task status.';

  const listEnabledCount = LIST_COLUMN_KEYS.filter((k) => list[k]).length;
  const boardEnabledCount = BOARD_CARD_FIELD_KEYS.filter((k) => board[k]).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-slate-900/35 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fields-panel-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col border-l border-white/40 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <h2 id="fields-panel-title" className="text-lg font-bold text-slate-900">
              Fields
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Show or hide list columns and board card details. Layout is saved in this browser (per board) and can be
              stored in saved views.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close fields panel"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {emphasis === 'list' ? (
            <>
              <ListSection
                list={list}
                onToggle={onToggleList}
                listEnabledCount={listEnabledCount}
                stagesLine={stagesLine}
              />
              <BoardSection board={board} onToggle={onToggleBoard} boardEnabledCount={boardEnabledCount} />
            </>
          ) : (
            <>
              <BoardSection board={board} onToggle={onToggleBoard} boardEnabledCount={boardEnabledCount} />
              <ListSection
                list={list}
                onToggle={onToggleList}
                listEnabledCount={listEnabledCount}
                stagesLine={stagesLine}
              />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            onClick={() => {
              onResetDefaults();
            }}
          >
            Reset all to defaults
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-500">At least one list column and one card field must stay on.</p>
        </div>
      </div>
    </div>
  );
}

function ListSection({
  list,
  onToggle,
  listEnabledCount,
  stagesLine,
}: {
  list: Record<ListColumnKey, boolean>;
  onToggle: (k: ListColumnKey) => void;
  listEnabledCount: number;
  stagesLine: string;
}) {
  return (
    <section className="mb-8" aria-labelledby="fields-list-heading">
      <h3 id="fields-list-heading" className="text-xs font-bold uppercase tracking-wide text-slate-500">
        List columns
      </h3>
      <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-snug text-slate-600">{stagesLine}</p>
      <ul className="mt-3 space-y-2">
        {LIST_COLUMN_KEYS.map((k) => {
          const on = list[k];
          const disableOff = on && listEnabledCount <= 1;
          return (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={on}
                  disabled={disableOff}
                  onChange={() => onToggle(k)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{LIST_COLUMN_LABELS[k]}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-600">{LIST_HINTS[k]}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BoardSection({
  board,
  onToggle,
  boardEnabledCount,
}: {
  board: Record<BoardCardFieldKey, boolean>;
  onToggle: (k: BoardCardFieldKey) => void;
  boardEnabledCount: number;
}) {
  return (
    <section className="mb-6" aria-labelledby="fields-board-heading">
      <h3 id="fields-board-heading" className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Board card fields
      </h3>
      <p className="mt-1 text-[11px] text-slate-600">Controls what appears on each kanban card (density still applies).</p>
      <ul className="mt-3 space-y-2">
        {BOARD_CARD_FIELD_KEYS.map((k) => {
          const on = board[k];
          const disableOff = on && boardEnabledCount <= 1;
          return (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={on}
                  disabled={disableOff}
                  onChange={() => onToggle(k)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{BOARD_CARD_LABELS[k]}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-600">{BOARD_HINTS[k]}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
