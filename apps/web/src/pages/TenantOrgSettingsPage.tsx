import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch, apiJson } from '../api/client';

type OrgPolicies = {
  projectCreationPolicy?: string;
  whoCanInvite?: string;
  inviteMaxRole?: string;
  defaultBoardTemplateKey?: string | null;
  defaultSlaStartPolicy?: string | null;
  defaultSlaDaysByPriority?: Record<string, number>;
};

function clampSlaDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(90, Math.max(1, Math.round(n)));
}

export function TenantOrgSettingsPage() {
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ['me-org'],
    queryFn: () => apiJson<{ membership: { role: string } }>('/auth/me'),
  });

  const settingsQ = useQuery({
    queryKey: ['tenant-settings'],
    enabled: meQ.data?.membership.role === 'ADMIN',
    queryFn: () => apiJson<{ settings: Record<string, unknown> }>('/tenant/settings'),
  });

  const [projectCreationPolicy, setProjectCreationPolicy] = useState('ADMIN_AND_MANAGER');
  const [whoCanInvite, setWhoCanInvite] = useState('ADMIN_AND_MANAGER');
  const [inviteMaxRole, setInviteMaxRole] = useState('MANAGER');
  const [defaultBoardTemplateKey, setDefaultBoardTemplateKey] = useState('');
  const [defaultSlaStartPolicy, setDefaultSlaStartPolicy] = useState('');
  const [legalHold, setLegalHold] = useState(false);
  const [customTemplatesJson, setCustomTemplatesJson] = useState('[]');
  const [orgD0, setOrgD0] = useState(1);
  const [orgD1, setOrgD1] = useState(2);
  const [orgD2, setOrgD2] = useState(3);
  const [orgD3, setOrgD3] = useState(5);
  const [orgD4, setOrgD4] = useState(7);

  useEffect(() => {
    const s = settingsQ.data?.settings ?? {};
    const org = (s.orgPolicies ?? {}) as OrgPolicies;
    if (org.projectCreationPolicy === 'ADMIN_ONLY' || org.projectCreationPolicy === 'ADMIN_AND_MANAGER') {
      setProjectCreationPolicy(org.projectCreationPolicy);
    }
    if (org.whoCanInvite === 'ADMIN' || org.whoCanInvite === 'ADMIN_AND_MANAGER') {
      setWhoCanInvite(org.whoCanInvite);
    }
    if (org.inviteMaxRole === 'MANAGER' || org.inviteMaxRole === 'EMPLOYEE') {
      setInviteMaxRole(org.inviteMaxRole);
    }
    setDefaultBoardTemplateKey(typeof org.defaultBoardTemplateKey === 'string' ? org.defaultBoardTemplateKey : '');
    setDefaultSlaStartPolicy(typeof org.defaultSlaStartPolicy === 'string' ? org.defaultSlaStartPolicy : '');
    const od = org.defaultSlaDaysByPriority;
    if (od && typeof od === 'object') {
      if (od.P0 != null) setOrgD0(od.P0);
      if (od.P1 != null) setOrgD1(od.P1);
      if (od.P2 != null) setOrgD2(od.P2);
      if (od.P3 != null) setOrgD3(od.P3);
      if (od.P4 != null) setOrgD4(od.P4);
    }
    setLegalHold(s.legalHold === true);
    try {
      setCustomTemplatesJson(JSON.stringify(s.customBoardTemplates ?? [], null, 2));
    } catch {
      setCustomTemplatesJson('[]');
    }
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      let customBoardTemplates: unknown;
      try {
        customBoardTemplates = JSON.parse(customTemplatesJson) as unknown;
      } catch {
        throw new Error('Custom board templates must be valid JSON');
      }
      if (!Array.isArray(customBoardTemplates)) {
        throw new Error('Custom board templates must be a JSON array');
      }
      const res = await apiFetch('/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalHold,
          customBoardTemplates,
          orgPolicies: {
            projectCreationPolicy,
            whoCanInvite,
            inviteMaxRole,
            defaultBoardTemplateKey: defaultBoardTemplateKey.trim() || null,
            defaultSlaStartPolicy: defaultSlaStartPolicy || null,
            defaultSlaDaysByPriority: {
              P0: clampSlaDay(orgD0),
              P1: clampSlaDay(orgD1),
              P2: clampSlaDay(orgD2),
              P3: clampSlaDay(orgD3),
              P4: clampSlaDay(orgD4),
            },
          },
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tenant-settings'] }),
  });

  if (meQ.isLoading || !meQ.data) return <p className="text-slate-600">Loading…</p>;
  if (meQ.data.membership.role !== 'ADMIN') {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organization</h1>
        <p className="mt-1 text-sm text-slate-600">Enterprise defaults and compliance flags (admin only).</p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/60 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md">
        {settingsQ.isLoading ? (
          <p className="text-sm text-slate-600">Loading settings…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Who can create projects</label>
              <select
                value={projectCreationPolicy}
                onChange={(e) => setProjectCreationPolicy(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ADMIN_AND_MANAGER">Admins and managers</option>
                <option value="ADMIN_ONLY">Admins only</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Who can invite users</label>
              <select
                value={whoCanInvite}
                onChange={(e) => setWhoCanInvite(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ADMIN_AND_MANAGER">Admins and managers</option>
                <option value="ADMIN">Admins only</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Maximum role for new invites</label>
              <select
                value={inviteMaxRole}
                onChange={(e) => setInviteMaxRole(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="MANAGER">Up to Manager</option>
                <option value="EMPLOYEE">Up to Employee (guests excluded)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Default board template key (optional)</label>
              <input
                value={defaultBoardTemplateKey}
                onChange={(e) => setDefaultBoardTemplateKey(e.target.value)}
                placeholder="e.g. software_sprint"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Default SLA start policy for new projects</label>
              <select
                value={defaultSlaStartPolicy}
                onChange={(e) => setDefaultSlaStartPolicy(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Use product default —</option>
                <option value="on_in_progress">When In Progress</option>
                <option value="on_create">On create</option>
                <option value="on_first_leave_backlog">When leaving first column</option>
              </select>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-600">Default SLA days by priority (new projects)</h3>
              <p className="mt-1 text-[11px] text-slate-500">Calendar days per priority when a new project inherits org defaults (1–90).</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {(
                  [
                    ['P0', orgD0, setOrgD0],
                    ['P1', orgD1, setOrgD1],
                    ['P2', orgD2, setOrgD2],
                    ['P3', orgD3, setOrgD3],
                    ['P4', orgD4, setOrgD4],
                  ] as const
                ).map(([label, val, set]) => (
                  <label key={label} className="text-center text-[10px] font-semibold uppercase text-slate-500">
                    {label}
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-1 py-1.5 text-center text-sm normal-case"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Custom board templates (JSON array)</label>
              <p className="mt-1 text-[11px] text-slate-500">
                Each item: templateKey, label, defaultStages[], optional description, defaultEstimateMode, sampleTasks. Merged into the template picker for new boards and projects.
              </p>
              <textarea
                value={customTemplatesJson}
                onChange={(e) => setCustomTemplatesJson(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                spellCheck={false}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={legalHold} onChange={(e) => setLegalHold(e.target.checked)} />
              Legal hold (enables extended compliance bundle export)
            </label>
            {save.isError && <p className="text-sm text-rose-700">{(save.error as Error).message}</p>}
            {save.isSuccess && <p className="text-sm text-emerald-800">Saved.</p>}
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {save.isPending ? 'Saving…' : 'Save organization settings'}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-700">
        <p className="font-semibold text-slate-800">Compliance export</p>
        <p className="mt-1">
          With legal hold on, admins can download <code className="font-mono">GET /admin/compliance/bundle.ndjson</code>{' '}
          (activity, tasks, comments) for a date range from your API client or automation.
        </p>
      </div>
    </div>
  );
}
