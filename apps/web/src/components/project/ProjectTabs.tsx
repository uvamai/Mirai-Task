import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { AddProjectViewModal } from './AddProjectViewModal';
import { List, LayoutGrid, Calendar, BarChartHorizontal, Table2, Plus, LayoutDashboard } from 'lucide-react';

export function ProjectTabs({
  projectId,
  activeBoardId,
}: {
  projectId: string;
  activeBoardId?: string;
}) {
  const boardBase = activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}` : undefined;
  const [addViewOpen, setAddViewOpen] = useState(false);

  const disabled = (label: string, icon: React.ReactNode) => (
    <span className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed" title="Coming soon">
      {icon}
      {label}
    </span>
  );

  const navClass = ({ isActive }: { isActive: boolean }) => 
    `flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition ${isActive ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`;

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200 w-full" aria-label="Project views">
      <AddProjectViewModal
        open={addViewOpen}
        onClose={() => setAddViewOpen(false)}
        projectId={projectId}
        boardId={activeBoardId}
      />
      
      <NavLink to={`/app/projects/${projectId}`} end className={navClass}>
        <LayoutDashboard size={14} className="text-slate-400" />
        Summary
      </NavLink>

      {boardBase ? (
        <>
          <NavLink to={`${boardBase}/list`} className={navClass}>
            <List size={14} className="text-slate-400" />
            List
          </NavLink>
          <NavLink to={boardBase} end className={navClass}>
            <LayoutGrid size={14} className="text-indigo-500" />
            Board
          </NavLink>
          <NavLink to={`${boardBase}/calendar`} className={navClass}>
            <Calendar size={14} className="text-orange-500" />
            Calendar
          </NavLink>
          <NavLink to={`${boardBase}/gantt`} className={navClass}>
            <BarChartHorizontal size={14} className="text-rose-500" />
            Gantt
          </NavLink>
          <NavLink to={`${boardBase}/table`} className={navClass}>
            <Table2 size={14} className="text-emerald-500" />
            Table
          </NavLink>
        </>
      ) : (
        <>
          {disabled('List', <List size={14} />)}
          {disabled('Board', <LayoutGrid size={14} />)}
          {disabled('Calendar', <Calendar size={14} />)}
          {disabled('Gantt', <BarChartHorizontal size={14} />)}
          {disabled('Table', <Table2 size={14} />)}
        </>
      )}

      <button
        type="button"
        onClick={() => setAddViewOpen(true)}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
      >
        <Plus size={14} />
        View
      </button>
    </nav>
  );
}
