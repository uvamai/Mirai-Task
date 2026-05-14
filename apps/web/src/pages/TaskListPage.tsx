import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiJson } from '../api/client';
import { TaskDetailPanel } from '../features/tasks/TaskDetailPanel';
import type { TaskRow, CustomFieldDef } from '../features/tasks/types';
import { TagPill } from '../components/TagPill';

type TasksPayload = {
  tasks: TaskRow[];
  estimateMode?: string;
  estimateUnitLabel?: string;
  workflowStages?: string[];
  customFieldDefs?: CustomFieldDef[];
};

type StagesPayload = { defaultStages: string[]; customStages: string[] | null };

export function TaskListPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const meQ = useQuery({
    queryKey: ['me-task-list'],
    queryFn: () => apiJson<{ membership: { role: string }; user: { id: string } }>('/auth/me'),
  });

  const stagesQ = useQuery({
    queryKey: ['kanban-stages', projectId, boardId],
    enabled: Boolean(projectId && boardId),
    queryFn: () =>
      apiJson<StagesPayload>(
        `/projects/${projectId}/kanban-stages${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ''}`
      ),
  });

  const tasksQ = useQuery({
    queryKey: ['tasks', boardId],
    enabled: Boolean(boardId),
    queryFn: () => apiJson<TasksPayload>(`/boards/${boardId}/tasks`),
  });

  const columns = useMemo(() => {
    const d = stagesQ.data;
    if (!d) return [];
    return d.customStages && d.customStages.length > 0 ? d.customStages : [...d.defaultStages];
  }, [stagesQ.data]);

  const wf = tasksQ.data?.workflowStages?.length ? tasksQ.data.workflowStages : columns;
  const estimateMode = (tasksQ.data?.estimateMode ?? 'story_points') as 'story_points' | 'hours';
  const sorted = useMemo(() => {
    const list = [...(tasksQ.data?.tasks ?? [])];
    list.sort((a, b) => {
      const st = a.status.localeCompare(b.status);
      if (st !== 0) return st;
      return a.position - b.position;
    });
    return list;
  }, [tasksQ.data?.tasks]);

  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = sorted.length > 48;
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  if (!projectId || !boardId) return <p className="text-slate-600">Missing board</p>;

  const role = meQ.data?.membership.role ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">List view</p>
          <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
        </div>
        <Link
          to={`/app/projects/${projectId}/boards/${boardId}`}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          ← Kanban board
        </Link>
      </div>

      <TaskDetailPanel
        taskId={selectedTaskId}
        boardId={boardId}
        columns={wf}
        membershipRole={role}
        userId={meQ.data?.user.id}
        estimateMode={estimateMode}
        onClose={() => setSelectedTaskId(null)}
      />

      {tasksQ.isLoading || stagesQ.isLoading ? (
        <p className="text-slate-600">Loading…</p>
      ) : useVirtual ? (
        <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/55 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <div className="grid grid-cols-[minmax(0,7rem)_1fr_6rem_4rem_5rem_3rem] gap-0 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-xs font-bold uppercase text-slate-600">
            <div>Key</div>
            <div>Title</div>
            <div>Status</div>
            <div>Prio</div>
            <div>Due</div>
            <div>Dep</div>
          </div>
          <div ref={parentRef} className="max-h-[min(70vh,560px)] overflow-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const t = sorted[vi.index];
                return (
                  <div
                    key={t.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vi.start}px)`,
                    }}
                    className="grid grid-cols-[minmax(0,7rem)_1fr_6rem_4rem_5rem_3rem] gap-0 border-b border-slate-100 px-3 py-2 text-sm hover:bg-indigo-50/40"
                    onClick={() => setSelectedTaskId(t.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedTaskId(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="font-semibold text-indigo-700">{t.key}</div>
                    <div className="min-w-0">
                      <div className="truncate text-slate-900">{t.title}</div>
                      {(t.tags ?? []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(t.tags ?? []).slice(0, 2).map((tag) => (
                            <TagPill key={tag} tag={tag} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-slate-700">{t.status}</div>
                    <div>{t.priority}</div>
                    <div className="text-slate-600">
                      {t.dueDate
                        ? typeof t.dueDate === 'string'
                          ? t.dueDate.slice(0, 10)
                          : String(t.dueDate).slice(0, 10)
                        : '—'}
                    </div>
                    <div className="text-slate-600">{(t.dependencies?.length ?? 0) > 0 ? t.dependencies!.length : '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/55 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Deps</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                  onClick={() => setSelectedTaskId(t.id)}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-indigo-700">{t.key}</td>
                  <td className="max-w-xs px-3 py-2 text-slate-900">
                    <div className="truncate">{t.title}</div>
                    {(t.tags ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(t.tags ?? []).slice(0, 2).map((tag) => (
                          <TagPill key={tag} tag={tag} />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{t.status}</td>
                  <td className="whitespace-nowrap px-3 py-2">{t.priority}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {t.dueDate
                      ? typeof t.dueDate === 'string'
                        ? t.dueDate.slice(0, 10)
                        : String(t.dueDate).slice(0, 10)
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {(t.dependencies?.length ?? 0) > 0 ? t.dependencies!.length : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
