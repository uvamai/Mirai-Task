import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { boardShellAppPath } from '../hooks/useBoardShellView';

export function LegacyBoardRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const q = useQuery({
    queryKey: ['project-boards-legacy', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiJson<{ boards: { id: string }[] }>(`/projects/${projectId}/boards`),
  });

  useEffect(() => {
    if (q.isError) return;
  }, [q.isError]);

  if (!projectId) return <Navigate to="/app" replace />;
  if (q.isLoading) return <p className="text-slate-600">Redirecting…</p>;
  if (q.isError) return <Navigate to="/app" replace />;
  const first = q.data?.boards[0]?.id;
  if (!first) return <Navigate to="/app" replace />;
  return <Navigate to={boardShellAppPath(projectId, first)} replace />;
}
