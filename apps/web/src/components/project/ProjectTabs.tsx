import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { AddProjectViewModal } from './AddProjectViewModal';
import { CustomizeBoardEntryModal } from './CustomizeBoardEntryModal';

export function ProjectTabs({
  projectId,
  activeBoardId,
}: {
  projectId: string;
  activeBoardId?: string;
}) {
  const boardBase = activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}` : undefined;
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const disabled = (label: string) => (
    <span className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-400" title="Coming soon">
      {label}
    </span>
  );

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Project views">
      <AddProjectViewModal
        open={addViewOpen}
        onClose={() => setAddViewOpen(false)}
        projectId={projectId}
        boardId={activeBoardId}
      />
      <CustomizeBoardEntryModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        boardId={activeBoardId}
      />
      <NavLink
        to={`/app/projects/${projectId}`}
        end
        className={({ isActive }) =>
          `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
        }
      >
        Summary
      </NavLink>
      <NavLink
        to={`/app/projects/${projectId}/getting-started`}
        className={({ isActive }) =>
          `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-indigo-900 text-white' : 'text-indigo-700 hover:bg-indigo-50'}`
        }
      >
        Get data in
      </NavLink>
      {boardBase ? (
        <>
          <NavLink
            to={`${boardBase}/list`}
            className={({ isActive }) =>
              `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
            }
          >
            List
          </NavLink>
          <NavLink
            to={`${boardBase}/table`}
            className={({ isActive }) =>
              `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
            }
          >
            Table
          </NavLink>
          <NavLink
            to={boardBase}
            end
            className={({ isActive }) =>
              `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
            }
          >
            Board
          </NavLink>
          <NavLink
            to={`${boardBase}/calendar`}
            className={({ isActive }) =>
              `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
            }
          >
            Calendar
          </NavLink>
        </>
      ) : (
        <>
          {disabled('List')}
          {disabled('Table')}
          {disabled('Board')}
          {disabled('Calendar')}
        </>
      )}
      {disabled('Timeline')}
      {disabled('Docs')}
      {disabled('Forms')}
      <button
        type="button"
        onClick={() => setAddViewOpen(true)}
        className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        + View
      </button>
      {boardBase ? (
        <button
          type="button"
          onClick={() => setCustomizeOpen(true)}
          className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-white"
          title="Default view when opening this board"
        >
          Customize
        </button>
      ) : null}
    </nav>
  );
}

