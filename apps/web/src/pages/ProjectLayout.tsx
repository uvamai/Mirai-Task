import { Link, NavLink, Outlet, useParams, useMatch } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useState } from 'react';
import { CreateBoardModal } from './CreateBoardModal';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { ProjectTabs } from '../components/project/ProjectTabs';

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
    queryFn: () =>
      apiJson<{ membership: { role: string }; tenant: { id: string; name: string } | null }>('/auth/me'),
  });

  const pq = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });

  const project = pq.data?.projects.find((p) => p.id === projectId);
  const boards = project?.boards ?? [];
  const projectMissing =
    Boolean(projectId) && pq.isSuccess && !pq.isFetching && project === undefined;
  const role = meQ.data?.membership.role ?? '';
  const canManage = ['ADMIN', 'MANAGER'].includes(role);
  const isAdmin = role === 'ADMIN';
  const defaultBoardId = boards[0]?.id;
  const activeBoardId = boardId ?? defaultBoardId;
  const activeBoardName = boards.find((b) => b.id === activeBoardId)?.name ?? (boards[0]?.name ?? 'Board');

  return (
    <div className="space-y-0">
      {projectMissing && (
        <div
          className="mx-auto mb-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">This project is not in your current workspace.</p>
          <p className="mt-1 text-amber-900/90">
            You are signed into <strong>{meQ.data?.tenant?.name ?? 'an organization'}</strong>
            {meQ.data?.tenant?.id ? (
              <>
                {' '}
                (<span className="font-mono text-xs">{meQ.data.tenant.id}</span>)
              </>
            ) : null}
            . The UVAMAI project lives under a different organization if your account has more than one.
          </p>
          <p className="mt-2">
            <strong>Fix:</strong> sign out, then sign in again and choose the correct workspace. If you use multiple
            tenants, open{' '}
            <Link className="font-semibold text-indigo-800 underline" to="/login">
              Sign in
            </Link>{' '}
            with{' '}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
              ?tenantId=&lt;workspace-uuid&gt;
            </code>{' '}
            (see docs) or ask an admin to add you to this project.
          </p>
        </div>
      )}
      <div className="border-b border-white/50 bg-white/60 px-6 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-6xl space-y-3">
          <ProjectHeader projectName={project?.name ?? 'Project'} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectTabs projectId={projectId ?? ''} activeBoardId={activeBoardId} />
              {boards.length > 0 && projectId && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Board</span>
                  <select
                    value={activeBoardId ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!next) return;
                      // hard navigate via location so we don't need a hook here
                      window.location.href = `/app/projects/${projectId}/boards/${encodeURIComponent(next)}`;
                    }}
                    className="max-w-[240px] truncate bg-transparent text-sm font-semibold text-slate-800 outline-none"
                    aria-label="Select board"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] font-semibold text-slate-500" title={activeBoardName}>
                    {activeBoardName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={() => setCreateBoardOpen(true)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  + Board
                </button>
              )}
              {isAdmin && (
                <NavLink
                  to={`/app/projects/${projectId}/settings`}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2 text-sm font-semibold ${
                      isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                    }`
                  }
                >
                  Intake
                </NavLink>
              )}
              <NavLink
                to={`/app/projects/${projectId}/reports${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ''}`}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-semibold ${
                    isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                  }`
                }
              >
                Reports
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
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
