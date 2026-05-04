import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiJson } from '../api/client';

export function ProjectReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sp] = useSearchParams();
  const boardId = sp.get('boardId') ?? undefined;
  const q = boardId ? `?boardId=${encodeURIComponent(boardId)}` : '';

  const slaQ = useQuery({
    queryKey: ['reports-sla', projectId, boardId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiJson<{ overdue: number; byPriority: Record<string, number>; total: number }>(
        `/projects/${projectId}/reports/sla${q}`
      ),
  });

  const tpQ = useQuery({
    queryKey: ['reports-tp', projectId, boardId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiJson<{ completedTasks14d: number; series: { day: string; count: number }[] }>(
        `/projects/${projectId}/reports/throughput${q}`
      ),
  });

  const ctQ = useQuery({
    queryKey: ['reports-cycle', projectId, boardId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiJson<{
        samples: { taskId: string; key: string; days: number }[];
        medianDays: number | null;
        averageDays: number | null;
      }>(`/projects/${projectId}/reports/cycle-time${q}${q ? '&' : '?'}days=30`),
  });

  const utilQ = useQuery({
    queryKey: ['reports-util', projectId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiJson<{
        windowDays: number;
        members: {
          userId: string;
          email: string | null;
          firstName: string | null;
          lastName: string | null;
          openTasks: number;
          wipTasks: number;
          completedInWindow: number;
          estimateSumOpen: number;
        }[];
      }>(`/projects/${projectId}/reports/utilization?days=14`),
  });

  if (!projectId) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-600">
          {boardId ? 'Filtered to current board.' : 'All boards in this project.'}
        </p>
      </div>

      <section className="rounded-2xl border border-white/50 bg-white/55 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">SLA overview</h3>
        {slaQ.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">Loading…</p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">Overdue</dt>
              <dd className="text-2xl font-bold text-rose-700">{slaQ.data?.overdue ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">Tasks</dt>
              <dd className="text-2xl font-bold text-slate-900">{slaQ.data?.total ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 sm:col-span-1">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">By priority</dt>
              <dd className="text-xs text-slate-700">
                {slaQ.data?.byPriority
                  ? Object.entries(slaQ.data.byPriority)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')
                  : '—'}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/55 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">Cycle time (30 days, Done tasks)</h3>
        <p className="mt-1 text-[11px] text-slate-500">From first move to In Progress through Done in activity (up to 300 samples).</p>
        {ctQ.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">Loading…</p>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">Median days</dt>
              <dd className="text-2xl font-bold text-slate-900">
                {ctQ.data?.medianDays != null ? ctQ.data.medianDays.toFixed(2) : '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">Average days</dt>
              <dd className="text-2xl font-bold text-slate-900">
                {ctQ.data?.averageDays != null ? ctQ.data.averageDays.toFixed(2) : '—'}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase text-slate-500">Samples</dt>
              <dd className="text-2xl font-bold text-indigo-800">{ctQ.data?.samples?.length ?? 0}</dd>
            </div>
          </dl>
        )}
        {!ctQ.isLoading && (ctQ.data?.samples?.length ?? 0) > 0 && (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
            {ctQ.data!.samples.slice(0, 20).map((s) => (
              <li key={s.taskId} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1">
                <span className="font-semibold text-indigo-800">{s.key}</span>
                <span>{s.days.toFixed(2)} d</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/55 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">Team utilization (assignees)</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Open = non-Done tasks; WIP = In Progress; completed counts Done tasks updated in the last {utilQ.data?.windowDays ?? 14} days.
        </p>
        {utilQ.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">Loading…</p>
        ) : utilQ.isError ? (
          <p className="mt-2 text-sm text-rose-700">{(utilQ.error as Error).message}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3">Open</th>
                  <th className="py-2 pr-3">WIP</th>
                  <th className="py-2 pr-3">Done (window)</th>
                  <th className="py-2">Est. sum</th>
                </tr>
              </thead>
              <tbody>
                {(utilQ.data?.members ?? []).map((m) => (
                  <tr key={m.userId} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || m.userId.slice(0, 8)}
                    </td>
                    <td className="py-2 pr-3">{m.openTasks}</td>
                    <td className="py-2 pr-3">{m.wipTasks}</td>
                    <td className="py-2 pr-3">{m.completedInWindow}</td>
                    <td className="py-2">{m.estimateSumOpen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/55 p-5 shadow-[var(--shadow-neu)] backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">Throughput (14 days)</h3>
        {tpQ.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">Loading…</p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-slate-800">
              <span className="font-semibold">{tpQ.data?.completedTasks14d ?? 0}</span> tasks completed (status Done).
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-600">
              {tpQ.data?.series.map((s) => (
                <li key={s.day} className="flex justify-between rounded-lg bg-slate-50 px-2 py-1">
                  <span>{s.day}</span>
                  <span className="font-semibold text-slate-900">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
