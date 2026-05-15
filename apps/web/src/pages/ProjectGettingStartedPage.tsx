import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { boardShellAppPath } from '../hooks/useBoardShellView';

type ProjectRow = {
  id: string;
  name: string;
  boards?: { id: string; name: string }[];
};

/**
 * PM8 lite — onboarding / import hub: surfaces existing T17 import, team, templates, and org settings
 * without duplicating the Import wizard (opened from the board toolbar).
 */
export function ProjectGettingStartedPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const pq = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });
  const project = pq.data?.projects.find((p) => p.id === projectId);
  const firstBoard = project?.boards?.[0];

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Get data in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Project <span className="font-semibold">{project?.name ?? '…'}</span> — import spreadsheets, invite people,
          and pick templates. (PM8 hub; T17 wizard lives on the board.)
        </p>
      </div>

      <ul className="space-y-3">
        <li className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900">Import Excel / CSV</h2>
          <p className="mt-1 text-xs text-slate-600">
            Managers open a board, then use <strong>Import from Excel</strong> in the board toolbar (empty board or
            from the banner). Multi-step wizard: upload → map columns → confirm; undo window and plan caps apply.
          </p>
          {firstBoard ? (
            <Link
              to={boardShellAppPath(projectId, firstBoard.id)}
              className="mt-3 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Open {firstBoard.name}
            </Link>
          ) : (
            <p className="mt-2 text-xs text-amber-800">No board yet — create one from the workspace dashboard.</p>
          )}
        </li>

        <li className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900">Invite the team</h2>
          <p className="mt-1 text-xs text-slate-600">Sharable links and roles from the Team screen.</p>
          <Link
            to={`/app/projects/${projectId}/team`}
            className="mt-3 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Team →
          </Link>
        </li>

        <li className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900">Board templates</h2>
          <p className="mt-1 text-xs text-slate-600">Mirai catalog + org custom templates; apply when creating a project.</p>
          <Link
            to={`/app/projects/${projectId}/templates`}
            className="mt-3 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Browse templates →
          </Link>
        </li>

        <li className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
          <h2 className="text-sm font-bold text-slate-900">Organization settings</h2>
          <p className="mt-1 text-xs text-slate-600">Admins edit custom board templates (JSON) and defaults.</p>
          <Link to="/app/org-settings" className="mt-3 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Org settings →
          </Link>
        </li>
      </ul>
    </div>
  );
}
