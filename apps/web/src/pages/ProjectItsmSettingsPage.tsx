import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '../api/client';

type RT = { key: string; label: string; defaultPriority: string };

type ProjectRow = {
  id: string;
  name: string;
  settings?: Record<string, unknown>;
  boards?: { id: string; name: string }[];
};

export function ProjectItsmSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ['me-itsm'],
    queryFn: () => apiJson<{ membership: { role: string }; tenant: { slug: string } | null }>('/auth/me'),
  });
  const pq = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });
  const project = pq.data?.projects.find((p) => p.id === projectId);
  const boards = project?.boards ?? [];
  const pi = (project?.settings?.publicIntake ?? {}) as {
    enabled?: boolean;
    requestTypes?: RT[];
    targetBoardId?: string | null;
  };

  const [enabled, setEnabled] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState('');
  const [rows, setRows] = useState<RT[]>([
    { key: 'product_feedback', label: 'Product feedback / improvement', defaultPriority: 'P3' },
    { key: 'incident', label: 'Incident', defaultPriority: 'P2' },
  ]);
  const [slaUseBusinessDays, setSlaUseBusinessDays] = useState(false);
  const [slaHolidaysText, setSlaHolidaysText] = useState('');

  useEffect(() => {
    setEnabled(pi.enabled === true);
    setTargetBoardId(typeof pi.targetBoardId === 'string' && pi.targetBoardId ? pi.targetBoardId : '');
    if (pi.requestTypes?.length) setRows(pi.requestTypes.map((r) => ({ ...r, defaultPriority: r.defaultPriority ?? 'P3' })));
    const s = project?.settings ?? {};
    setSlaUseBusinessDays(s.slaUseBusinessDays === true);
    const cal = Array.isArray(s.slaHolidayCalendar) ? s.slaHolidayCalendar : [];
    setSlaHolidaysText(cal.filter((x): x is string => typeof x === 'string').join('\n'));
  }, [project?.settings, pi.enabled, pi.requestTypes, pi.targetBoardId]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicIntake: {
            enabled,
            requestTypes: rows.filter((r) => r.key.trim() && r.label.trim()),
            targetBoardId: targetBoardId.trim() ? targetBoardId.trim() : null,
          },
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const saveSla = useMutation({
    mutationFn: async () => {
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      const slaHolidayCalendar = slaHolidaysText
        .split(/[\n,;]+/g)
        .map((s) => s.trim())
        .filter((s) => iso.test(s));
      const res = await apiFetch(`/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slaUseBusinessDays,
          slaHolidayCalendar,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  if (!projectId) return null;
  if (meQ.data?.membership.role !== 'ADMIN') {
    return <Navigate to={`/app/projects/${projectId}`} replace />;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const slug = meQ.data?.tenant?.slug ?? 'YOUR_TENANT_SLUG';
  const publicUrl = `${origin}/request/${encodeURIComponent(slug)}/${projectId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">ITSM — Intake &amp; continuous feedback</h2>
        <p className="text-sm text-slate-600">
          Public form for <span className="font-semibold">{project?.name ?? 'this project'}</span>—incidents, requests, or
          ongoing product feedback. Share the link below (tenant slug comes from your signed-in session). Route feedback to
          a dedicated board (for example <span className="font-medium">Product improvement</span>) so it does not land on
          the default board only.
        </p>
        <p className="mt-2 break-all text-xs text-indigo-800">{publicUrl}</p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable public intake
        </label>
        <p className="mt-2 text-[11px] text-slate-500">When enabled, at least one request type is required.</p>

        <label className="mt-4 block text-xs font-semibold text-slate-600">Board for new requests</label>
        <select
          value={targetBoardId}
          onChange={(e) => setTargetBoardId(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">First board (project default order)</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500">
          Intake tasks are created here. Choose your roadmap or feedback board so submissions stay visible with the right
          workstream.
        </p>

        <div className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-3">
              <input
                placeholder="key"
                value={r.key}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...r, key: e.target.value };
                  setRows(next);
                }}
                className="rounded border border-slate-200 px-2 py-1 text-sm font-mono"
              />
              <input
                placeholder="Label"
                value={r.label}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...r, label: e.target.value };
                  setRows(next);
                }}
                className="rounded border border-slate-200 px-2 py-1 text-sm"
              />
              <select
                value={r.defaultPriority}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...r, defaultPriority: e.target.value };
                  setRows(next);
                }}
                className="rounded border border-slate-200 px-2 py-1 text-sm"
              >
                {(['P0', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-semibold text-indigo-700 hover:underline"
            onClick={() => setRows([...rows, { key: 'request', label: 'Request', defaultPriority: 'P3' }])}
          >
            + Add request type
          </button>
        </div>

        {save.isError && <p className="mt-2 text-sm text-rose-700">{(save.error as Error).message}</p>}
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save intake configuration'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h2 className="text-lg font-bold text-slate-900">SLA calendar</h2>
        <p className="mt-1 text-sm text-slate-600">
          When business-day SLA is enabled, each SLA day skips weekends and the listed YYYY-MM-DD holidays.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={slaUseBusinessDays}
            onChange={(e) => setSlaUseBusinessDays(e.target.checked)}
          />
          Count SLA in business days (Mon–Fri)
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-600">Holiday calendar (one YYYY-MM-DD per line)</label>
        <textarea
          value={slaHolidaysText}
          onChange={(e) => setSlaHolidaysText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
          placeholder={'2026-01-01\n2026-12-25'}
        />
        {saveSla.isError && <p className="mt-2 text-sm text-rose-700">{(saveSla.error as Error).message}</p>}
        <button
          type="button"
          disabled={saveSla.isPending}
          onClick={() => saveSla.mutate()}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saveSla.isPending ? 'Saving…' : 'Save SLA calendar'}
        </button>
      </div>
    </div>
  );
}
