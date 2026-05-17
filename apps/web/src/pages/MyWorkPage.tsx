import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { apiJson } from '../api/client';
import { TagPill } from '../components/TagPill';
import { boardShellAppPath } from '../hooks/useBoardShellView';
import { AlertTriangle, Clock, Calendar, CheckCircle2, ArrowRight, Filter } from 'lucide-react';

type Row = {
  id: string; key: string; title: string; status: string; priority: string;
  dueDate: string | null; tags?: string[]; projectId: string; boardId: string; projectName: string;
};

const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
const prioStyles: Record<string, { label: string; bg: string; text: string }> = {
  P0: { label: 'P0', bg: 'bg-red-100', text: 'text-red-700' },
  P1: { label: 'P1', bg: 'bg-orange-100', text: 'text-orange-700' },
  P2: { label: 'P2', bg: 'bg-amber-100', text: 'text-amber-700' },
  P3: { label: 'P3', bg: 'bg-blue-100', text: 'text-blue-700' },
  P4: { label: 'P4', bg: 'bg-slate-100', text: 'text-slate-600' },
};

function today() { return new Date().toISOString().slice(0, 10); }
function endOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() + (6 - d.getDay()));
  return d.toISOString().slice(0, 10);
}

function getDueGroup(dueDate: string | null): 'overdue' | 'today' | 'week' | 'later' | 'none' {
  if (!dueDate) return 'none';
  const d = String(dueDate).slice(0, 10);
  if (d < today()) return 'overdue';
  if (d === today()) return 'today';
  if (d <= endOfWeek()) return 'week';
  return 'later';
}

const groups = [
  { key: 'overdue', label: 'Overdue', icon: <AlertTriangle size={15} className="text-rose-600" />, accent: 'border-l-rose-500', badge: 'bg-rose-50 text-rose-700 border border-rose-200' },
  { key: 'today', label: 'Due Today', icon: <Clock size={15} className="text-amber-600" />, accent: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { key: 'week', label: 'This Week', icon: <Calendar size={15} className="text-indigo-500" />, accent: 'border-l-indigo-400', badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  { key: 'later', label: 'Upcoming', icon: <CheckCircle2 size={15} className="text-emerald-500" />, accent: 'border-l-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { key: 'none', label: 'No Due Date', icon: <Calendar size={15} className="text-slate-400" />, accent: 'border-l-slate-300', badge: 'bg-slate-50 text-slate-600 border border-slate-200' },
] as const;

function TaskRow({ t, accentClass }: { t: Row; accentClass: string }) {
  const prio = prioStyles[t.priority] ?? prioStyles.P4;
  const dueStr = t.dueDate ? String(t.dueDate).slice(0, 10) : null;
  const isOverdue = dueStr && dueStr < today();
  return (
    <Link
      to={boardShellAppPath(t.projectId, t.boardId)}
      className={`group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all border-l-4 ${accentClass}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${prio.bg} ${prio.text}`}>{prio.label}</span>
          <span className="shrink-0 text-[11px] font-semibold text-indigo-600">{t.key}</span>
          <span className="truncate text-sm font-medium text-slate-800">{t.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">{t.projectName}</span>
          <span className="text-[11px] text-slate-300">·</span>
          <span className="text-[11px] text-slate-500 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5">{t.status}</span>
          {(t.tags ?? []).slice(0, 2).map((tag) => <TagPill key={tag} tag={tag} />)}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {dueStr && (
          <span className={`text-[11px] font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-500'}`}>
            {isOverdue ? '⚠ ' : ''}{dueStr}
          </span>
        )}
        <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition" />
      </div>
    </Link>
  );
}

export function MyWorkPage() {
  const [sortBy, setSortBy] = useState<'due' | 'project' | 'priority'>('due');

  const q = useQuery({
    queryKey: ['my-work'],
    queryFn: () => apiJson<{ tasks: Row[] }>('/tasks/my-work'),
  });

  const sorted = useMemo(() => {
    const list = [...(q.data?.tasks ?? [])];
    if (sortBy === 'project') list.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.key.localeCompare(b.key));
    else if (sortBy === 'priority') list.sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9) || a.key.localeCompare(b.key));
    else list.sort((a, b) => {
      const ad = a.dueDate ? String(a.dueDate).slice(0, 10) : '9999-99-99';
      const bd = b.dueDate ? String(b.dueDate).slice(0, 10) : '9999-99-99';
      return ad !== bd ? ad.localeCompare(bd) : a.key.localeCompare(b.key);
    });
    return list;
  }, [q.data?.tasks, sortBy]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>(groups.map(g => [g.key, []]));
    for (const t of sorted) {
      const g = getDueGroup(t.dueDate);
      map.get(g)!.push(t);
    }
    return map;
  }, [sorted]);

  const total = q.data?.tasks.length ?? 0;
  const overdueCt = grouped.get('overdue')?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">My Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} open task{total !== 1 ? 's' : ''} assigned to you
            {overdueCt > 0 && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700"><AlertTriangle size={11} />{overdueCt} overdue</span>}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Filter size={14} />
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value as 'due' | 'project' | 'priority')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            <option value="due">Sort: Due date</option>
            <option value="project">Sort: Project</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </label>
      </div>

      {q.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {q.isError && <p className="text-sm text-rose-700">Could not load tasks.</p>}

      {q.data && total === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <CheckCircle2 size={48} className="text-emerald-400 mb-3" />
          <p className="font-bold text-slate-600">You're all caught up!</p>
          <p className="text-sm text-slate-400 mt-1">No open tasks assigned to you.</p>
        </div>
      )}

      {q.data && total > 0 && (
        <div className="space-y-6">
          {groups.map(({ key, label, icon, accent, badge }) => {
            const items = grouped.get(key) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={key}>
                <div className="mb-2 flex items-center gap-2">
                  {icon}
                  <h2 className="text-sm font-bold text-slate-700">{label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge}`}>{items.length}</span>
                </div>
                <ul className="space-y-2" aria-label={`${label} tasks`}>
                  {items.map((t) => <li key={t.id}><TaskRow t={t} accentClass={accent} /></li>)}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
