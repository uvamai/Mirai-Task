import { Navigate, useParams } from 'react-router-dom';
import { boardShellRelativePath } from '../hooks/useBoardShellView';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiJson } from '../api/client';
import { CreateBoardModal } from './CreateBoardModal';
import { ImportExcelModal } from './ImportExcelModal';

type Row = { id: string; boards?: { id: string }[] };

export function ProjectBoardIndex() {
  const { projectId } = useParams<{ projectId: string }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const q = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: Row[] }>('/projects'),
  });

  const meQ = useQuery({
    queryKey: ['me-project-board-index'],
    queryFn: () => apiJson<{ membership: { role: string } }>('/auth/me'),
  });

  if (!projectId) return <Navigate to="/app" replace />;
  if (q.isLoading) return <p className="text-slate-600">Loading…</p>;
  const b = q.data?.projects.find((p) => p.id === projectId)?.boards?.[0]?.id;
  if (b) return <Navigate to={boardShellRelativePath(b)} replace />;

  const canManage = ['ADMIN', 'MANAGER'].includes(meQ.data?.membership.role ?? '');
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-white/50 bg-white/70 p-8 text-center shadow-sm backdrop-blur-md">
      <h2 className="text-lg font-bold text-slate-900">No boards yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        Start from a built-in template, or drop in an Excel/CSV file to create a board with your existing
        rows already mapped.
      </p>
      {canManage && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Create board from template
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Import from Excel
          </button>
        </div>
      )}
      <CreateBoardModal
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void q.refetch()}
      />
      <ImportExcelModal
        projectId={projectId}
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void q.refetch();
        }}
      />
    </div>
  );
}
