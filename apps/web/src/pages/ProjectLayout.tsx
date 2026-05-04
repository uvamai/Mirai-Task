import { Link, NavLink, Outlet, useParams, useMatch } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useState } from 'react';
import { CreateBoardModal } from './CreateBoardModal';

type ProjectRow = {
  id: string;
  name: string;
  boards?: { id: string; name: string; position?: number }[];
};

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const boardMatch = useMatch('/app/projects/:projectId/boards/:boardId');
  const boardId = boardMatch?.params.boardId;
  const qc = useQueryClient();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const meQ = useQuery({
    queryKey: ['me-project-layout'],
    queryFn: () => apiJson<{ membership: { role: string } }>('/auth/me'),
  });

  const pq = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });

  const project = pq.data?.projects.find((p) => p.id === projectId);
  const boards = project?.boards ?? [];
  const role = meQ.data?.membership.role ?? '';
  const canManage = ['ADMIN', 'MANAGER'].includes(role);
  const isAdmin = role === 'ADMIN';
  const defaultBoardId = boards[0]?.id;
  const activeBoardId = boardId ?? defaultBoardId;

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-20 -mx-6 border-b border-white/40 bg-white/80 px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/app" className="text-xs font-semibold text-indigo-700">
              ← Projects
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{project?.name ?? 'Project'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {boards.map((b) => (
              <NavLink
                key={b.id}
                to={`/app/projects/${projectId}/boards/${b.id}`}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-900/20'
                      : 'bg-white/80 text-slate-700 ring-1 ring-slate-200/80 hover:bg-white'
                  }`
                }
              >
                {b.name}
              </NavLink>
            ))}
            {canManage && (
              <button
                type="button"
                onClick={() => setCreateBoardOpen(true)}
                className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-500 hover:text-slate-900"
              >
                + Board
              </button>
            )}
          </div>
        </div>
        <nav className="mt-3 flex flex-wrap gap-4 border-t border-white/60 pt-2 text-sm font-semibold text-slate-600">
          <NavLink
            end
            to={activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}` : '#'}
            className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            onClick={(e) => {
              if (!activeBoardId) e.preventDefault();
            }}
          >
            Board
          </NavLink>
          <NavLink
            to={activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}/list` : '#'}
            className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            onClick={(e) => {
              if (!activeBoardId) e.preventDefault();
            }}
          >
            List
          </NavLink>
          <NavLink
            to={activeBoardId ? `/app/projects/${projectId}/boards/${activeBoardId}/calendar` : '#'}
            className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            onClick={(e) => {
              if (!activeBoardId) e.preventDefault();
            }}
          >
            Calendar
          </NavLink>
          {canManage && (
            <NavLink
              to={`/app/projects/${projectId}/team`}
              className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            >
              Team
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to={`/app/projects/${projectId}/settings`}
              className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            >
              ITSM intake
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to={`/app/projects/${projectId}/automations`}
              className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
            >
              Automations
            </NavLink>
          )}
          <NavLink
            to={`/app/projects/${projectId}/reports${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ''}`}
            className={({ isActive }) => (isActive ? 'text-indigo-800' : 'hover:text-slate-900')}
          >
            Reports
          </NavLink>
        </nav>
      </div>

      <div className="pt-6">
        <Outlet />
      </div>

      {projectId && (
        <CreateBoardModal
          projectId={projectId}
          open={createBoardOpen}
          onClose={() => setCreateBoardOpen(false)}
          onCreated={() => void qc.invalidateQueries({ queryKey: ['projects'] })}
        />
      )}
    </div>
  );
}
