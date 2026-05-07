import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { apiJson } from '../api/client';
import { TagPill } from '../components/TagPill';

type Row = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  tags?: string[];
  projectId: string;
  boardId: string;
  projectName: string;
};

const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

export function MyWorkPage() {
  const [sortBy, setSortBy] = useState<'due' | 'project' | 'priority'>('due');

  const q = useQuery({
    queryKey: ['my-work'],
    queryFn: () => apiJson<{ tasks: Row[] }>('/tasks/my-work'),
  });

  const sorted = useMemo(() => {
    const list = [...(q.data?.tasks ?? [])];
    if (sortBy === 'project') {
      list.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.key.localeCompare(b.key));
    } else if (sortBy === 'priority') {
      list.sort(
        (a, b) =>
          (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9) || a.key.localeCompare(b.key)
      );
    } else {
      list.sort((a, b) => {
        const ad = a.dueDate ? String(a.dueDate).slice(0, 10) : '9999-99-99';
        const bd = b.dueDate ? String(b.dueDate).slice(0, 10) : '9999-99-99';
        if (ad !== bd) return ad.localeCompare(bd);
        return a.key.localeCompare(b.key);
      });
    }
    return list;
  }, [q.data?.tasks, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My work</h1>
          <p className="text-sm text-slate-600">Open tasks assigned to you across projects.</p>
        </div>
        <label className="text-xs font-semibold text-slate-600">
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'due' | 'project' | 'priority')}
            className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="due">Due date</option>
            <option value="project">Project</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </div>
      {q.isLoading && <p className="text-slate-600">Loading…</p>}
      {q.isError && <p className="text-rose-700">Could not load tasks.</p>}
      {q.data && q.data.tasks.length === 0 && <p className="text-sm text-slate-600">No open assigned tasks.</p>}
      {q.data && q.data.tasks.length > 0 && (
        <ul className="space-y-2" aria-label="My assigned tasks">
          {sorted.map((t) => (
            <li key={t.id}>
              <Link
                to={`/app/projects/${t.projectId}/boards/${t.boardId}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-white/50 bg-white/55 px-4 py-3 text-sm shadow-sm backdrop-blur-md hover:border-indigo-200"
              >
                <span>
                  <span className="font-semibold text-indigo-700">{t.key}</span>
                  <span className="text-slate-900"> — {t.title}</span>
                  {(t.tags ?? []).slice(0, 2).map((tag) => (
                    <span key={tag} className="ml-2">
                      <TagPill tag={tag} />
                    </span>
                  ))}
                </span>
                <span className="text-xs text-slate-600">
                  {t.projectName} · {t.status} · {t.priority}
                  {t.dueDate ? ` · due ${String(t.dueDate).slice(0, 10)}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
