import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '../api/client';

type Member = { userId: string; role: string; email?: string; firstName?: string; lastName?: string };
type Employee = { userId: string; email?: string; firstName?: string; lastName?: string };
type ProjectRow = { id: string; name: string; settings?: Record<string, unknown> };

function clampSlaDay(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(90, Math.max(1, Math.round(n)));
}

export function ProjectTeamPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('CONTRIBUTOR');
  const [slaStartPolicy, setSlaStartPolicy] = useState('on_in_progress');
  const [d0, setD0] = useState(1);
  const [d1, setD1] = useState(2);
  const [d2, setD2] = useState(3);
  const [d3, setD3] = useState(5);
  const [d4, setD4] = useState(7);

  const meQ = useQuery({
    queryKey: ['me-team'],
    queryFn: () => apiJson<{ membership: { role: string }; user: { id: string } }>('/auth/me'),
  });

  const membersQ = useQuery({
    queryKey: ['project-members', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiJson<{ members: Member[] }>(`/projects/${projectId}/members`),
  });

  const employeesQ = useQuery({
    queryKey: ['employees-team'],
    queryFn: () => apiJson<{ employees: Employee[] }>('/employees'),
  });

  const projectsQ = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiJson<{ projects: ProjectRow[] }>('/projects'),
  });

  const proj = projectsQ.data?.projects.find((p) => p.id === projectId);
  const myRole = meQ.data?.membership.role ?? '';
  const myMember = membersQ.data?.members.find((m) => m.userId === meQ.data?.user.id);
  const canEditSla = myRole === 'ADMIN' || myRole === 'MANAGER' || myMember?.role === 'LEAD';

  useEffect(() => {
    const s = proj?.settings;
    if (!s) return;
    const pol = s.slaStartPolicy;
    if (pol === 'on_create' || pol === 'on_first_leave_backlog' || pol === 'on_in_progress') setSlaStartPolicy(pol);
    const days = s.slaDaysByPriority as Record<string, number> | undefined;
    if (days?.P0 != null) setD0(days.P0);
    if (days?.P1 != null) setD1(days.P1);
    if (days?.P2 != null) setD2(days.P2);
    if (days?.P3 != null) setD3(days.P3);
    if (days?.P4 != null) setD4(days.P4);
  }, [proj?.settings]);

  const add = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Missing project');
      const res = await apiFetch(`/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Add failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project-members', projectId] });
      setUserId('');
    },
  });

  const remove = useMutation({
    mutationFn: async (uid: string) => {
      if (!projectId) throw new Error('Missing project');
      const res = await apiFetch(`/projects/${projectId}/members/${uid}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? 'Remove failed');
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['project-members', projectId] }),
  });

  const saveSla = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Missing project');
      const res = await apiFetch(`/projects/${projectId}/sla-policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slaStartPolicy,
          slaDaysByPriority: {
            P0: clampSlaDay(d0),
            P1: clampSlaDay(d1),
            P2: clampSlaDay(d2),
            P3: clampSlaDay(d3),
            P4: clampSlaDay(d4),
          },
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  if (!projectId) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Project team</h2>
        <p className="text-sm text-slate-600">Employees only see projects they are added to here.</p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">Add member</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select user…</option>
            {employeesQ.data?.employees.map((e) => (
              <option key={e.userId} value={e.userId}>
                {e.firstName} {e.lastName} ({e.email})
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="LEAD">Lead</option>
            <option value="CONTRIBUTOR">Contributor</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            type="button"
            disabled={!userId || add.isPending}
            onClick={() => add.mutate()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {add.isError && <p className="mt-2 text-sm text-rose-700">{(add.error as Error).message}</p>}
      </div>

      {canEditSla && (
        <div className="rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <h3 className="text-xs font-bold uppercase text-slate-600">SLA policy (calendar days)</h3>
          <p className="mt-1 text-[11px] text-slate-500">Defaults: P0=1, P1=2, P2=3, P3=5, P4=7. When the SLA clock starts depends on the policy below.</p>
          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-600">Start policy</label>
            <select
              value={slaStartPolicy}
              onChange={(e) => setSlaStartPolicy(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="on_in_progress">When status becomes In Progress</option>
              <option value="on_create">When task is created</option>
              <option value="on_first_leave_backlog">When leaving first workflow column</option>
            </select>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
            {(
              [
                ['P0', d0, setD0],
                ['P1', d1, setD1],
                ['P2', d2, setD2],
                ['P3', d3, setD3],
                ['P4', d4, setD4],
              ] as const
            ).map(([label, val, set]) => (
              <div key={label}>
                <div className="font-bold text-slate-600">{label}</div>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={val}
                  onChange={(e) => set(clampSlaDay(parseInt(e.target.value, 10)))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-1 py-1"
                />
              </div>
            ))}
          </div>
          {saveSla.isError && <p className="mt-2 text-sm text-rose-700">{(saveSla.error as Error).message}</p>}
          <button
            type="button"
            disabled={saveSla.isPending}
            onClick={() => saveSla.mutate()}
            className="mt-3 rounded-xl bg-indigo-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saveSla.isPending ? 'Saving…' : 'Save SLA policy'}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {membersQ.data?.members.map((m) => (
          <li
            key={m.userId}
            className="flex items-center justify-between rounded-xl border border-white/50 bg-white/55 px-4 py-3 text-sm shadow-sm backdrop-blur-md"
          >
            <div>
              <span className="font-medium text-slate-900">
                {m.firstName} {m.lastName}
              </span>
              <span className="ml-2 text-slate-500">{m.email}</span>
              <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {m.role}
              </span>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-rose-700 hover:underline"
              onClick={() => remove.mutate(m.userId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
