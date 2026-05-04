import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiJson } from '../api/client';
import { PlanLimitModal } from '../components/PlanLimitModal';

type ProjectRow = { id: string; name: string; settings?: Record<string, unknown> };

type TemplateRow = {
  templateKey: string;
  label: string;
  description?: string;
  businessType: string;
  defaultStages: string[];
};

export function DashboardPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState('default');
  const [seedSampleTasks, setSeedSampleTasks] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [limitTitle, setLimitTitle] = useState('Plan limit');
  const [limitAction, setLimitAction] = useState<{ to: string; label: string }>({
    to: '/app/billing',
    label: 'Billing & usage',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });

  const templatesQ = useQuery({
    queryKey: ['board-templates'],
    queryFn: () => apiJson<{ templates: TemplateRow[] }>('/board-templates'),
  });

  useEffect(() => {
    const keys = new Set((templatesQ.data?.templates ?? []).map((t) => t.templateKey));
    if (keys.size > 0 && !keys.has(templateKey)) {
      setTemplateKey('default');
    }
  }, [templatesQ.data, templateKey]);

  const create = useMutation({
    mutationFn: async (payload: { name: string; templateKey: string; seedSampleTasks: boolean }) => {
      const res = await apiFetch('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(body.error ?? 'Failed');
        if (body.code) (err as Error & { code?: string }).code = body.code;
        throw err;
      }
      return body as ProjectRow;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setTemplateKey('default');
      setSeedSampleTasks(false);
    },
    onError: (e: Error & { code?: string }) => {
      if (e.code === 'LIMIT_PROJECTS') {
        setLimitTitle('Plan limit');
        setLimitAction({ to: '/app/billing', label: 'Billing & usage' });
        setLimitMsg(e.message);
        setLimitOpen(true);
      } else if (e.code === 'ORG_POLICY_PROJECT_CREATE') {
        setLimitTitle('Organization policy');
        setLimitAction({ to: '/app/org-settings', label: 'Organization settings' });
        setLimitMsg(e.message);
        setLimitOpen(true);
      }
    },
  });

  const effectiveTemplateKey =
    (templatesQ.data?.templates ?? []).some((t) => t.templateKey === templateKey) ? templateKey : 'default';
  const selected = templatesQ.data?.templates.find((t) => t.templateKey === effectiveTemplateKey);

  return (
    <div className="space-y-8">
      <PlanLimitModal
        open={limitOpen}
        title={limitTitle}
        action={limitAction}
        message={limitMsg}
        onClose={() => setLimitOpen(false)}
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <p className="mt-1 text-sm text-slate-600">Open a board or create a new project with an optional template.</p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-white/50 bg-white/50 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!name.trim()) return;
          const keys = new Set((templatesQ.data?.templates ?? []).map((t) => t.templateKey));
          const tk = keys.has(templateKey) ? templateKey : 'default';
          create.mutate({ name: name.trim(), templateKey: tk, seedSampleTasks });
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-semibold text-slate-600" htmlFor="pname">
              New project name
            </label>
            <input
              id="pname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm"
              placeholder="Delivery board"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Template</label>
            <select
              value={
                (templatesQ.data?.templates ?? []).some((t) => t.templateKey === templateKey) ? templateKey : 'default'
              }
              onChange={(e) => setTemplateKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {(templatesQ.data?.templates ?? []).length === 0 && (
                <option value="default">Blank board (default)</option>
              )}
              {(templatesQ.data?.templates ?? []).map((t) => (
                <option key={t.templateKey} value={t.templateKey}>
                  {t.label}
                </option>
              ))}
            </select>
            {selected?.description && <p className="mt-1 text-xs text-slate-600">{selected.description}</p>}
            {selected && (
              <p className="mt-1 text-[11px] text-slate-500">Columns: {selected.defaultStages.join(' → ')}</p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-slate-700">
            <input type="checkbox" checked={seedSampleTasks} onChange={(e) => setSeedSampleTasks(e.target.checked)} />
            Seed sample tasks from template
          </label>
        </div>
        {create.isError &&
          !['LIMIT_PROJECTS', 'ORG_POLICY_PROJECT_CREATE'].includes(
            (create.error as Error & { code?: string }).code ?? ''
          ) && <p className="text-sm text-rose-700">{(create.error as Error).message}</p>}
      </form>

      {isLoading && <p className="text-slate-600">Loading…</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {data?.projects.map((p) => (
          <li key={p.id}>
            <Link
              to={`/app/projects/${p.id}`}
              className="block rounded-2xl border border-white/50 bg-white/55 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md transition hover:bg-white/75"
            >
              <span className="font-semibold text-slate-900">{p.name}</span>
              <p className="mt-1 text-xs text-slate-500">Open Kanban board →</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
