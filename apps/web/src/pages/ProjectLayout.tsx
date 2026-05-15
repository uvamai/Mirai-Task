import { Link, NavLink, Outlet, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useEffect, useMemo, useState } from 'react';
import { CreateBoardModal } from './CreateBoardModal';
import { ImportExcelModal } from './ImportExcelModal';
import { ProjectHeader } from '../components/project/ProjectHeader';
import { ProjectTabs } from '../components/project/ProjectTabs';
import { BoardSwitcher } from '../components/project/BoardSwitcher';
import { useRecentNavigation } from '../hooks/useRecentNavigation';
import { boardShellAppPath, parseBoardIdFromProjectPath, shellViewFromPathname, setBoardShellView } from '../hooks/useBoardShellView';

type ProjectRow = {
  id: string;
  name: string;
  boards?: { id: string; name: string; position?: number }[];
};

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const routeBoardId = useMemo(
    () => (projectId ? parseBoardIdFromProjectPath(projectId, location.pathname) : undefined),
    [projectId, location.pathname]
  );
  const qc = useQueryClient();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { push: pushRecent } = useRecentNavigation();

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
  const boards = useMemo(() => project?.boards ?? [], [project]);
  const projectMissing =
    Boolean(projectId) && pq.isSuccess && !pq.isFetching && project === undefined;
  const role = meQ.data?.membership.role ?? '';
  const canManage = ['ADMIN', 'MANAGER'].includes(role);
  const isAdmin = role === 'ADMIN';
  const defaultBoardId = boards[0]?.id;
  const activeBoardId = routeBoardId ?? defaultBoardId;

  useEffect(() => {
    if (!routeBoardId) return;
    const inferred = shellViewFromPathname(location.pathname, routeBoardId);
    if (inferred) setBoardShellView(routeBoardId, inferred);
  }, [routeBoardId, location.pathname]);

  /**
   * M7/M8 — Record the current board into Cmd/Ctrl+K palette recents whenever
   * the user lands on a board route. Empty boards (no boardId in URL) and
   * unknown boards are skipped.
   */
  useEffect(() => {
    if (!projectId || !routeBoardId || !project) return;
    const found = boards.find((b) => b.id === routeBoardId);
    if (!found) return;
    pushRecent({
      key: `b:${routeBoardId}`,
      label: `${project.name} · ${found.name}`,
      to: boardShellAppPath(projectId, routeBoardId),
      hint: 'Board',
    });
  }, [projectId, routeBoardId, project, boards, pushRecent, location.pathname]);

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
          <ProjectHeader
            workspaceName={meQ.data?.tenant?.name ?? 'Workspace'}
            projectId={projectId ?? ''}
            projectName={project?.name ?? 'Project'}
            activeBoardId={activeBoardId}
            isAdmin={isAdmin}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectTabs projectId={projectId ?? ''} activeBoardId={activeBoardId} />
              {boards.length > 0 && projectId && (
                <BoardSwitcher
                  projectId={projectId}
                  projectName={project?.name ?? 'Project'}
                  activeBoardId={activeBoardId ?? undefined}
                  boards={boards.map((b) => ({ id: b.id, name: b.name }))}
                  canManage={canManage}
                  onCreateBoard={() => setCreateBoardOpen(true)}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => setCreateBoardOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                  >
                    + Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                    title="Create a new board from an Excel/CSV file"
                  >
                    Import from Excel
                  </button>
                </>
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
                to={`/app/projects/${projectId}/reports${routeBoardId ? `?boardId=${encodeURIComponent(routeBoardId)}` : ''}`}
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
        <>
          <CreateBoardModal
            projectId={projectId}
            open={createBoardOpen}
            onClose={() => setCreateBoardOpen(false)}
            onCreated={() => void qc.invalidateQueries({ queryKey: ['projects'] })}
          />
          <ImportExcelModal
            projectId={projectId}
            open={importOpen}
            onClose={() => {
              setImportOpen(false);
              void qc.invalidateQueries({ queryKey: ['projects'] });
            }}
          />
        </>
      )}
    </div>
  );
}
