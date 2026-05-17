import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiJson } from '../api/client';
import {
  AlertTriangle, Clock, BarChart2, TrendingUp, Users,
  CheckCircle2, Activity, Zap,
} from 'lucide-react';

/* ─── Pure-SVG chart primitives (zero deps) ─── */

function BarChart({ series }: { series: { day: string; count: number }[] }) {
  if (!series.length) return <p className="text-xs text-slate-400 py-4 text-center">No data yet.</p>;
  const max = Math.max(...series.map(s => s.count), 1);
  const h = 120;
  const barW = Math.floor(Math.min(32, (600 / series.length) - 4));
  const gap = 4;
  const totalW = series.length * (barW + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={h + 32} aria-label="Throughput bar chart" className="overflow-visible">
        {series.map((s, i) => {
          const barH = Math.max(4, Math.round((s.count / max) * h));
          const x = i * (barW + gap);
          const y = h - barH;
          const isWeekend = new Date(s.day).getDay() % 6 === 0;
          return (
            <g key={s.day}>
              <rect x={x} y={y} width={barW} height={barH}
                fill={s.count === 0 ? '#f1f5f9' : isWeekend ? '#a5b4fc' : '#6366f1'}
                rx={4} className="transition-all" />
              {s.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="text-[9px]" fill="#64748b" fontSize={9}>
                  {s.count}
                </text>
              )}
              <text x={x + barW / 2} y={h + 16} textAnchor="middle" fill="#94a3b8" fontSize={8}>
                {s.day.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ value, total, label, color }: { value: number; total: number; label: string; color: string }) {
  const pct = total > 0 ? value / total : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const gap = circ - dash;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={100} height={100} viewBox="0 0 100 100" aria-label={label}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x={50} y={46} textAnchor="middle" fill="#0f172a" fontSize={16} fontWeight={700}>{value}</text>
        <text x={50} y={61} textAnchor="middle" fill="#94a3b8" fontSize={9}>{label}</text>
      </svg>
    </div>
  );
}

function CycleHistogram({ samples }: { samples: { taskId: string; key: string; days: number }[] }) {
  if (!samples.length) return <p className="text-xs text-slate-400 py-4 text-center">No cycle-time data yet.</p>;
  const buckets = [1, 3, 7, 14, 30, Infinity];
  const labels = ['≤1d', '1-3d', '3-7d', '7-14d', '14-30d', '>30d'];
  const counts = buckets.map((_, i) => {
    const lo = i === 0 ? 0 : buckets[i - 1];
    const hi = buckets[i];
    return samples.filter(s => s.days > lo && s.days <= hi).length;
  });
  const max = Math.max(...counts, 1);
  const barW = 48, gap = 10, h = 100;
  return (
    <svg width={(barW + gap) * buckets.length} height={h + 36} aria-label="Cycle time histogram">
      {counts.map((cnt, i) => {
        const barH = Math.max(4, Math.round((cnt / max) * h));
        const x = i * (barW + gap);
        const colors = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444', '#7f1d1d'];
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} fill={colors[i]} rx={4} />
            {cnt > 0 && <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle" fill="#64748b" fontSize={9}>{cnt}</text>}
            <text x={x + barW / 2} y={h + 16} textAnchor="middle" fill="#94a3b8" fontSize={9}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Stat tile ─── */
function StatTile({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

/* ─── Main page ─── */
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
      apiJson<{ samples: { taskId: string; key: string; days: number }[]; medianDays: number | null; averageDays: number | null }>(
        `/projects/${projectId}/reports/cycle-time${q}${q ? '&' : '?'}days=30`
      ),
  });

  const utilQ = useQuery({
    queryKey: ['reports-util', projectId],
    enabled: Boolean(projectId),
    queryFn: () =>
      apiJson<{
        windowDays: number;
        members: {
          userId: string; email: string | null; firstName: string | null;
          lastName: string | null; openTasks: number; wipTasks: number;
          completedInWindow: number; estimateSumOpen: number;
        }[];
      }>(`/projects/${projectId}/reports/utilization?days=14`),
  });

  if (!projectId) return null;

  const slaHealth = slaQ.data
    ? Math.max(0, Math.round(100 - ((slaQ.data.overdue / Math.max(slaQ.data.total, 1)) * 100)))
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart2 size={20} className="text-indigo-500" /> Reports & Analytics
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {boardId ? 'Filtered to current board.' : 'Aggregated across all boards in this project.'}
          </p>
        </div>
      </div>

      {/* ── SLA Overview ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
          <AlertTriangle size={15} className="text-amber-500" /> SLA Overview
        </h3>
        {slaQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Tasks" value={slaQ.data?.total ?? 0} icon={<Activity size={16} />} color="#6366f1" />
            <StatTile label="SLA Breached" value={slaQ.data?.overdue ?? 0} sub="Overdue tasks" icon={<AlertTriangle size={16} />} color="#ef4444" />
            <StatTile label="SLA Health" value={slaHealth !== null ? `${slaHealth}%` : '—'} sub="100% = no breaches" icon={<CheckCircle2 size={16} />} color={slaHealth !== null && slaHealth >= 80 ? '#10b981' : '#f59e0b'} />
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">By Priority</p>
              {slaQ.data?.byPriority
                ? Object.entries(slaQ.data.byPriority).map(([k, v]) => (
                  <div key={k} className="flex w-full items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">{k}</span>
                    <span className={`font-bold tabular-nums ${v > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{v}</span>
                  </div>
                ))
                : <span className="text-sm text-slate-400">—</span>}
            </div>
          </div>
        )}
        {!slaQ.isLoading && slaQ.data && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            <DonutChart
              value={slaQ.data.overdue}
              total={slaQ.data.total}
              label="Overdue"
              color="#ef4444"
            />
            <DonutChart
              value={Math.max(0, slaQ.data.total - slaQ.data.overdue)}
              total={slaQ.data.total}
              label="On Track"
              color="#10b981"
            />
          </div>
        )}
      </section>

      {/* ── Throughput ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700">
          <TrendingUp size={15} className="text-indigo-500" /> Throughput — last 14 days
        </h3>
        <p className="mb-4 text-[11px] text-slate-400">Tasks reaching "Done" per day. Weekends highlighted in purple.</p>
        {tpQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl font-extrabold text-slate-900">{tpQ.data?.completedTasks14d ?? 0}</span>
              <span className="text-sm text-slate-500">tasks completed</span>
            </div>
            <BarChart series={tpQ.data?.series ?? []} />
          </>
        )}
      </section>

      {/* ── Cycle Time ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Clock size={15} className="text-purple-500" /> Cycle Time — last 30 days
        </h3>
        <p className="mb-4 text-[11px] text-slate-400">From first "In Progress" move to "Done". Distribution of task durations.</p>
        {ctQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <StatTile label="Median" value={ctQ.data?.medianDays != null ? `${ctQ.data.medianDays.toFixed(1)}d` : '—'} icon={<Clock size={16} />} color="#8b5cf6" />
              <StatTile label="Average" value={ctQ.data?.averageDays != null ? `${ctQ.data.averageDays.toFixed(1)}d` : '—'} icon={<Activity size={16} />} color="#6366f1" />
              <StatTile label="Samples" value={ctQ.data?.samples?.length ?? 0} sub="Completed tasks" icon={<Zap size={16} />} color="#10b981" />
            </div>
            <CycleHistogram samples={ctQ.data?.samples ?? []} />
          </>
        )}
      </section>

      {/* ── Team Utilization ── */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Users size={15} className="text-teal-500" /> Team Utilization
        </h3>
        <p className="mb-4 text-[11px] text-slate-400">
          Open = non-Done; WIP = In Progress; Done = completed in last {utilQ.data?.windowDays ?? 14} days.
        </p>
        {utilQ.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : utilQ.isError ? (
          <p className="text-sm text-rose-600">{(utilQ.error as Error).message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-4">Member</th>
                  <th className="py-3 pr-4 text-center">Open</th>
                  <th className="py-3 pr-4 text-center">In Progress</th>
                  <th className="py-3 pr-4 text-center">Done (window)</th>
                  <th className="py-3 text-center">Est. Points</th>
                </tr>
              </thead>
              <tbody>
                {(utilQ.data?.members ?? []).map((m) => {
                  const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || m.userId.slice(0, 8);
                  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
                  const load = m.openTasks > 10 ? 'high' : m.openTasks > 5 ? 'medium' : 'normal';
                  return (
                    <tr key={m.userId} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 shrink-0">
                            {initials}
                          </div>
                          <span className="font-semibold text-slate-800">{name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          load === 'high' ? 'bg-rose-100 text-rose-700' :
                          load === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{m.openTasks}</span>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{m.wipTasks}</span>
                      </td>
                      <td className="py-3 pr-4 text-center">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{m.completedInWindow}</span>
                      </td>
                      <td className="py-3 text-center font-semibold text-slate-600 tabular-nums">{m.estimateSumOpen || '—'}</td>
                    </tr>
                  );
                })}
                {(utilQ.data?.members ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No team members assigned to tasks yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
