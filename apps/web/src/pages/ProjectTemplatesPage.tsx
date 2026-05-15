import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';

type TemplateRow = {
  templateKey: string;
  label: string;
  description?: string;
  businessType: string;
  defaultStages: string[];
};

/**
 * PM7 lite — templates center: read-only catalog from `/board-templates` (same as workspace dashboard).
 * “Use in project” = create a new project from `/app` with that template (no marketplace).
 */
export function ProjectTemplatesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const templatesQ = useQuery({
    queryKey: ['board-templates'],
    queryFn: () => apiJson<{ templates: TemplateRow[] }>('/board-templates'),
  });

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Catalog of board templates for new projects. To apply one, use{' '}
          <Link to="/app" className="font-semibold text-indigo-700 underline">
            Workspace dashboard
          </Link>{' '}
          → create project → pick template. Org admins can add custom templates under Org settings.
        </p>
      </div>

      {templatesQ.isLoading ? (
        <p className="text-sm text-slate-600">Loading templates…</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(templatesQ.data?.templates ?? []).map((t) => (
            <li
              key={t.templateKey}
              className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md"
            >
              <p className="text-xs font-mono text-slate-500">{t.templateKey}</p>
              <h2 className="mt-1 text-sm font-bold text-slate-900">{t.label}</h2>
              <p className="mt-1 text-xs text-slate-600">{t.description ?? '—'}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase text-slate-400">{t.businessType}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Stages: {t.defaultStages?.length ? t.defaultStages.join(' · ') : '—'}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        <Link to={`/app/projects/${projectId}/getting-started`} className="font-semibold text-indigo-700">
          ← Get data in
        </Link>
      </p>
    </div>
  );
}
