import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiJson } from '../api/client';
import { PlanLimitModal } from '../components/PlanLimitModal';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Folders,
  Plus, ArrowRight, Zap, Users, BarChart2, ShieldCheck,
} from 'lucide-react';

type ProjectRow = { id: string; name: string; settings?: Record<string, unknown> };
type TemplateRow = { templateKey: string; label: string; description?: string; businessType: string; defaultStages: string[] };

type DashboardKpi = { total: number; overdue: number; inProgress: number; doneThisWeek: number; myOpenTasks: number };
type ProjectHealth = {
  id: string; name: string; total: number; done: number; overdue: number;
  inProgress: number; health: number; boards: { id: string; name: string }[]; estimateSum: number;
};

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, color, to,
}: { icon: React.ReactNode; label: string; value: number; sub?: string; color: string; to?: string }) {
  const inner = (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${to ? 'cursor-pointer' : ''}`}>
      <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full opacity-10`} style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl`} style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
        {to && <ArrowRight size={16} className="text-slate-300 mt-1" />}
      </div>
      <p className="mt-4 text-3xl font-extrabold text-slate-900 tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>;
}

export function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState('default');
  const [seedSampleTasks, setSeedSampleTasks] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [limitTitle, setLimitTitle] = useState('Plan limit');
  const [limitAction, setLimitAction] = useState<{ to: string; label: string }>({ to: '/app/billing', label: 'Billing & usage' });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiJson<{ kpi: DashboardKpi; projects: ProjectHealth[] }>('/dashboard/summary'),
    refetchInterval: 60_000,
  });

  const templatesQ = useQuery({
    queryKey: ['board-templates'],
    queryFn: () => apiJson<{ templates: TemplateRow[] }>('/board-templates'),
  });

  useEffect(() => {
    const keys = new Set((templatesQ.data?.templates ?? []).map((t) => t.templateKey));
    if (keys.size > 0 && !keys.has(templateKey)) setTemplateKey('default');
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
    onSuccess: (proj) => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setName(''); setTemplateKey('default'); setSeedSampleTasks(false); setShowCreate(false);
      navigate(`/app/projects/${proj.id}`);
    },
    onError: (e: Error & { code?: string }) => {
      if (e.code === 'LIMIT_PROJECTS') { setLimitTitle('Plan limit'); setLimitAction({ to: '/app/billing', label: 'Billing & usage' }); setLimitMsg(e.message); setLimitOpen(true); }
      else if (e.code === 'ORG_POLICY_PROJECT_CREATE') { setLimitTitle('Organization policy'); setLimitAction({ to: '/app/org-settings', label: 'Organization settings' }); setLimitMsg(e.message); setLimitOpen(true); }
    },
  });

  const kpi = summaryData?.kpi;
  const projects = summaryData?.projects ?? [];
  const effectiveTemplateKey = (templatesQ.data?.templates ?? []).some((t) => t.templateKey === templateKey) ? templateKey : 'default';
  const selected = templatesQ.data?.templates.find((t) => t.templateKey === effectiveTemplateKey);

  return (
    <div className="space-y-8">
      <PlanLimitModal open={limitOpen} title={limitTitle} action={limitAction} message={limitMsg} onClose={() => setLimitOpen(false)} />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Command Centre</h1>
          <p className="mt-1 text-sm text-slate-500">Enterprise overview across all your projects.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition active:scale-95"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Create Panel */}
      {showCreate && (
        <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Create New Project</h2>
          <form
            data-testid="create-project-form"
            className="space-y-4"
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
                <label className="text-xs font-semibold text-slate-600" htmlFor="pname">Project name *</label>
                <input
                  id="pname" value={name} onChange={(e) => setName(e.target.value)} data-testid="project-name"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Platform Migration Q3"
                />
              </div>
              <button
                type="submit" disabled={create.isPending || !name.trim()} data-testid="create-project-submit"
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Template</label>
                <select
                  value={effectiveTemplateKey} onChange={(e) => setTemplateKey(e.target.value)}
                  data-testid="project-template" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {(templatesQ.data?.templates ?? []).length === 0 && <option value="default">Blank board (default)</option>}
                  {(templatesQ.data?.templates ?? []).map((t) => (<option key={t.templateKey} value={t.templateKey}>{t.label}</option>))}
                </select>
                {selected?.description && <p className="mt-1 text-xs text-slate-500">{selected.description}</p>}
                {selected && <p className="mt-1 text-[11px] text-slate-400">Columns: {selected.defaultStages.join(' → ')}</p>}
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-6 text-sm text-slate-600">
                <input type="checkbox" checked={seedSampleTasks} onChange={(e) => setSeedSampleTasks(e.target.checked)} data-testid="project-seed-samples" />
                Seed with sample tasks
              </label>
            </div>
            {create.isError && !['LIMIT_PROJECTS', 'ORG_POLICY_PROJECT_CREATE'].includes((create.error as Error & { code?: string }).code ?? '') &&
              <p className="text-sm text-rose-700">{(create.error as Error).message}</p>}
          </form>
        </div>
      )}

      {/* KPI Row */}
      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={<Folders size={20} />} label="Total Tasks" value={kpi?.total ?? 0} color="#6366f1" />
          <KpiCard icon={<AlertTriangle size={20} />} label="Overdue" value={kpi?.overdue ?? 0} sub="SLA or due date" color="#ef4444" to="/app/my-work" />
          <KpiCard icon={<Clock size={20} />} label="In Progress" value={kpi?.inProgress ?? 0} color="#f59e0b" />
          <KpiCard icon={<CheckCircle2 size={20} />} label="Done this week" value={kpi?.doneThisWeek ?? 0} color="#10b981" />
          <KpiCard icon={<Zap size={20} />} label="My Open Tasks" value={kpi?.myOpenTasks ?? 0} color="#8b5cf6" to="/app/my-work" />
        </div>
      )}

      {/* Project Health Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 size={18} className="text-indigo-500" /> Project Health
          </h2>
          <span className="text-xs text-slate-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
        {summaryLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <Folders size={40} className="text-slate-300 mb-3" />
            <p className="font-semibold text-slate-500">No projects yet</p>
            <p className="text-sm text-slate-400 mt-1">Create your first project to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={16} /> New Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const healthColor = p.health >= 80 ? 'text-emerald-600 bg-emerald-50' : p.health >= 50 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              const primaryBoard = p.boards[0];
              const href = primaryBoard ? `/app/projects/${p.id}/boards/${primaryBoard.id}` : `/app/projects/${p.id}`;
              return (
                <Link key={p.id} to={href} data-project-id={p.id} data-project-name={p.name}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition">{p.name}</p>
                      {p.boards.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {p.boards.map(b => b.name).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className={`ml-3 shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${healthColor}`}>
                      <ShieldCheck size={12} /> {p.health}%
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Completion</span>
                      <span className="font-semibold text-slate-700">{pct}% ({p.done}/{p.total})</span>
                    </div>
                    <HealthBar value={pct} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-xs font-bold text-slate-800">{p.inProgress}</p>
                      <p className="text-[10px] text-slate-400">In Progress</p>
                    </div>
                    <div className={`rounded-lg px-2 py-2 ${p.overdue > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                      <p className={`text-xs font-bold ${p.overdue > 0 ? 'text-rose-700' : 'text-slate-800'}`}>{p.overdue}</p>
                      <p className="text-[10px] text-slate-400">Overdue</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-xs font-bold text-slate-800">{p.estimateSum > 0 ? p.estimateSum : '—'}</p>
                      <p className="text-[10px] text-slate-400">Pts</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end text-[11px] font-medium text-indigo-500 opacity-0 group-hover:opacity-100 transition">
                    Open board <ArrowRight size={12} className="ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Links footer */}
      <div className="grid gap-3 sm:grid-cols-3 border-t border-slate-100 pt-6">
        {[
          { icon: <Users size={16} />, label: 'Team Members', sub: 'Manage your team', to: '/app/employees', color: '#6366f1' },
          { icon: <TrendingUp size={16} />, label: 'My Work', sub: 'Tasks assigned to you', to: '/app/my-work', color: '#10b981' },
          { icon: <BarChart2 size={16} />, label: 'Reports', sub: 'Open a project to view reports', to: '/app', color: '#f59e0b' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm shadow-sm hover:border-indigo-200 hover:shadow-md transition group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}18`, color: item.color }}>
              {item.icon}
            </div>
            <div>
              <p className="font-semibold text-slate-800 group-hover:text-indigo-700 transition">{item.label}</p>
              <p className="text-[11px] text-slate-400">{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
