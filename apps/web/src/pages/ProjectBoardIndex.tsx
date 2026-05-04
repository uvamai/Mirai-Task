import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';

type Row = { id: string; boards?: { id: string }[] };

export function ProjectBoardIndex() {
  const { projectId } = useParams<{ projectId: string }>();
  const q = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: Row[] }>('/projects'),
  });
  if (!projectId) return <Navigate to="/app" replace />;
  if (q.isLoading) return <p className="text-slate-600">Loading…</p>;
  const b = q.data?.projects.find((p) => p.id === projectId)?.boards?.[0]?.id;
  if (!b) return <Navigate to="/app" replace />;
  return <Navigate to={`boards/${b}`} replace />;
}
