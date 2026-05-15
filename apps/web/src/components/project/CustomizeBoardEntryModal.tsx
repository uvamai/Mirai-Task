import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { BoardShellView } from '../../hooks/useBoardShellView';
import { getBoardShellView, setBoardShellView } from '../../hooks/useBoardShellView';

const OPTIONS: { id: BoardShellView; title: string; description: string }[] = [
  { id: 'board', title: 'Board', description: 'Kanban columns for this board' },
  { id: 'list', title: 'List', description: 'Sortable table of tasks' },
  { id: 'calendar', title: 'Calendar', description: 'Due dates on a calendar' },
];

export function CustomizeBoardEntryModal({
  open,
  onClose,
  boardId,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<BoardShellView>('board');

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open || !boardId) return;
    setChoice(getBoardShellView(boardId));
  }, [open, boardId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function apply(next: BoardShellView) {
    setChoice(next);
    if (boardId) setBoardShellView(boardId, next);
  }

  const node = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-view-title"
        className="glass-modal-card relative z-10 w-full max-w-md rounded-2xl border border-white/60 p-6 shadow-2xl"
      >
        <h2 id="customize-view-title" className="text-lg font-bold text-slate-900">
          Default board entry
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          When you open this board from the switcher, command palette, or project home, Mirai navigates here first. You
          can still switch tabs anytime.
        </p>

        {!boardId ? (
          <p className="mt-4 text-sm text-amber-800">Select a board first (use the board switcher).</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {OPTIONS.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => apply(o.id)}
                  className={`flex w-full flex-col rounded-xl border px-3 py-3 text-left transition ${
                    choice === o.id
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white/80 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm font-bold text-slate-900">{o.title}</span>
                  <span className="text-xs text-slate-600">{o.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
