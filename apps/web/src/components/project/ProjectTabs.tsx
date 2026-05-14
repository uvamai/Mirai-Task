import { NavLink } from 'react-router-dom';

export function ProjectTabs({
  projectId,
  activeBoardId,
}: {
  projectId: string;
  activeBoardId?: string;
}) {
  const boardBase = activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}` : undefined;

  const disabled = (label: string) => (
    <span className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-400" title="Coming soon">
      {label}
    </span>
  );

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Project views">
      <NavLink
        to={`/app/projects/${projectId}`}
        end
        className={({ isActive }) =>
          `rounded-lg px-2 py-1 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70'}`
        }
      >
        Summary
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
          {disabled('Board')}
          {disabled('Calendar')}
        </>
      )}
      {disabled('Timeline')}
      {disabled('Docs')}
      {disabled('Forms')}
    </nav>
  );
}

