import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import type { TaskRow, CustomFieldDef } from '../features/tasks/types';

type TasksPayload = {
  tasks: TaskRow[];
  estimateMode?: string;
  customFieldDefs?: CustomFieldDef[];
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDue(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = typeof d === 'string' ? d : String(d);
  return s.slice(0, 10);
}

export function TaskCalendarPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();

  const tasksQ = useQuery({
    queryKey: ['tasks', boardId],
    enabled: Boolean(boardId),
    queryFn: () => apiJson<TasksPayload>(`/boards/${boardId}/tasks`),
  });

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const changeQ = useQuery({
    queryKey: ['change-calendar', projectId, boardId, weekStart.toISOString()],
    enabled: Boolean(projectId && boardId),
    queryFn: () =>
      apiJson<{
        changes: {
          id: string;
          key: string;
          title: string;
          changeWindowStart: unknown;
          changeWindowEnd: unknown;
        }[];
      }>(
        `/projects/${projectId}/reports/change-calendar?boardId=${encodeURIComponent(boardId!)}&from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(weekEnd.toISOString())}`
      ),
  });

  const byDay = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const day of days) m.set(dayKey(day), []);
    for (const t of tasksQ.data?.tasks ?? []) {
      const k = parseDue(t.dueDate);
      if (!k) continue;
      const list = m.get(k);
      if (list) list.push(t);
    }
    return m;
  }, [tasksQ.data?.tasks, days]);

  if (!projectId || !boardId) return <p className="text-slate-600">Missing board</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Calendar (this week)</p>
          <h2 className="text-lg font-bold text-slate-900">Due dates</h2>
        </div>
        <Link
          to={`/app/projects/${projectId}/boards/${boardId}`}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          ← Kanban board
        </Link>
      </div>

      {tasksQ.isLoading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {days.map((d) => {
            const k = dayKey(d);
            const list = byDay.get(k) ?? [];
            return (
              <div
                key={k}
                className="min-h-[140px] rounded-2xl border border-white/50 bg-white/55 p-2 shadow-sm backdrop-blur-md"
              >
                <div className="border-b border-slate-100 pb-1 text-center text-xs font-bold text-slate-600">
                  <div>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="text-lg text-slate-900">{d.getDate()}</div>
                </div>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {list.map((t) => (
                    <li key={t.id} className="rounded-lg bg-indigo-50/80 px-1.5 py-1 text-slate-800 ring-1 ring-indigo-100">
                      <span className="font-semibold text-indigo-800">{t.key}</span>
                      <div className="truncate text-slate-700">{t.title}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-white/50 bg-white/55 p-4 shadow-sm backdrop-blur-md">
        <h3 className="text-xs font-bold uppercase text-slate-600">Change windows (CAB)</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Tasks with <span className="font-mono">metadata.changeWindowStart</span> /{' '}
          <span className="font-mono">changeWindowEnd</span> overlapping this week on this board.
        </p>
        {changeQ.isLoading ? (
          <p className="mt-2 text-sm text-slate-600">Loading…</p>
        ) : changeQ.isError ? (
          <p className="mt-2 text-sm text-rose-700">{(changeQ.error as Error).message}</p>
        ) : (changeQ.data?.changes?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No change windows in this range.</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
            {changeQ.data!.changes.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-2">
                <span className="font-semibold text-indigo-800">{c.key}</span>
                <div className="text-slate-800">{c.title}</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {String(c.changeWindowStart)} → {String(c.changeWindowEnd)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
