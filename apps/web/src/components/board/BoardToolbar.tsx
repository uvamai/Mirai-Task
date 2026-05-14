import { useState } from 'react';

export function BoardToolbar({
  canManageBoard,
  isAdmin,
  canCreate,
  density,
  onDensity,
  onEditColumns,
  onSaveTemplate,
  onNewTask,
}: {
  canManageBoard: boolean;
  isAdmin: boolean;
  canCreate: boolean;
  density: 'comfortable' | 'dense';
  onDensity: (d: 'comfortable' | 'dense') => void;
  onEditColumns: () => void;
  onSaveTemplate: () => void;
  onNewTask: () => void;
}) {
  const [q, setQ] = useState('');

  return (
    <div className="sticky top-3 z-10 space-y-2 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Board</p>
          <p className="text-sm text-slate-700">Drag cards between columns. Drag a column edge to resize.</p>
        </div>
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
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search board (coming soon)…"
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
        />
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          onClick={() => alert('Filters (coming soon)')}
        >
          Filter
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          onClick={() => alert('Group by (coming soon)')}
        >
          Group by
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          onClick={() => alert('Import work (coming soon)')}
        >
          Import work
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          onClick={() => alert('Options (coming soon)')}
          aria-label="View options"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}

