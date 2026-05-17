import { Outlet, useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useEffect, useMemo, useState } from 'react';
import { CreateBoardModal } from './CreateBoardModal';
import { ImportExcelModal } from './ImportExcelModal';
import { ProjectTabs } from '../components/project/ProjectTabs';
import { BoardSwitcher } from '../components/project/BoardSwitcher';
import { useRecentNavigation } from '../hooks/useRecentNavigation';
import { boardShellAppPath, parseBoardIdFromProjectPath, shellViewFromPathname, setBoardShellView } from '../hooks/useBoardShellView';
import { ProjectGeneratorModal } from '../features/projects/ProjectGeneratorModal';
import { Star, MoreHorizontal, Share2, Sparkles, Zap, FileSpreadsheet } from 'lucide-react';

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
  const [aiOpen, setAiOpen] = useState(false);
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
  const defaultBoardId = boards[0]?.id;
  const activeBoardId = routeBoardId ?? defaultBoardId;
  const workspaceName = meQ.data?.tenant?.name ?? 'Workspace';

  useEffect(() => {
    if (!routeBoardId) return;
    const inferred = shellViewFromPathname(location.pathname, routeBoardId);
    if (inferred) setBoardShellView(routeBoardId, inferred);
  }, [routeBoardId, location.pathname]);

  useEffect(() => {
    if (!projectId || !project) return;
    
    // Always push the project as a recent link
    pushRecent({
      key: `p:${projectId}`,
      label: project.name,
      to: `/app/projects/${projectId}`,
      hint: 'Project',
    });

    if (routeBoardId) {
      const found = boards.find((b) => b.id === routeBoardId);
      if (found) {
        pushRecent({
          key: `b:${routeBoardId}`,
          label: `${project.name} · ${found.name}`,
          to: boardShellAppPath(projectId, routeBoardId),
          hint: 'Board',
        });
      }
    }
  }, [projectId, routeBoardId, project, boards, pushRecent, location.pathname]);

  return (
    <div className="flex flex-col h-full w-full">
      {projectMissing && (
        <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <p className="font-semibold">This project is not in your current workspace.</p>
          <p className="mt-1 text-amber-900/90">
            You are signed into <strong>{workspaceName}</strong>.
          </p>
        </div>
      )}

      {/* Project Header Area */}
      <div className="bg-white border-b border-slate-200 pt-4 px-6 shrink-0">
        <div className="flex flex-col gap-4">
          
          {/* Top Row: Breadcrumb & Favorites */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-700">
                  {workspaceName.charAt(0)}
                </div>
                <span>{workspaceName}</span>
                <span>/</span>
              </div>
              <h1 className="text-slate-900 font-bold flex items-center gap-2 text-lg">
                {project?.name ?? 'Project'}
                <button className="text-slate-300 hover:text-amber-400 transition ml-1">
                  <Star size={16} />
                </button>
              </h1>
            </div>

            <div className="flex items-center gap-2">
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
          </div>

          {/* Bottom Row: Tabs & Actions */}
          <div className="flex items-end justify-between w-full">
            <div className="flex-1 flex overflow-x-auto no-scrollbar">
              <ProjectTabs projectId={projectId ?? ''} activeBoardId={activeBoardId} />
            </div>

            <div className="flex items-center gap-2 pb-2 pl-4">
              {canManage && (
                <>
                  <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition border border-transparent">
                    <FileSpreadsheet size={14} /> Import
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition border border-transparent">
                    <Zap size={14} /> Automate
                  </button>
                  <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm hover:opacity-90 rounded-md transition">
                    <Sparkles size={14} /> Ask AI
                  </button>
                </>
              )}
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition border border-transparent">
                <Share2 size={14} /> Share
              </button>
              <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area - Full Width/Height */}
      <div className="flex-1 overflow-auto bg-slate-50 relative">
        <Outlet />
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
          <ProjectGeneratorModal
            projectId={projectId}
            open={aiOpen}
            onClose={() => setAiOpen(false)}
          />
        </>
      )}
    </div>
  );
}
