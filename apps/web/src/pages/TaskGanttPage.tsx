import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { apiJson, apiFetch } from '../api/client';
import type { TaskRow } from '../features/tasks/types';

type TasksPayload = {
  tasks: TaskRow[];
};

export function TaskGanttPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>(ViewMode.Day);

  const tasksQ = useQuery({
    queryKey: ['tasks', boardId],
    enabled: Boolean(boardId),
    queryFn: () => apiJson<TasksPayload>(`/boards/${boardId}/tasks`),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (args: { id: string; start: Date; end: Date }) => {
      const res = await apiFetch(`/tasks/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: args.start.toISOString().slice(0, 10),
          dueDate: args.end.toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error('Update failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const ganttTasks = useMemo((): GanttTask[] => {
    const raw = tasksQ.data?.tasks ?? [];
    if (raw.length === 0) return [];

    return raw.map((t) => {
      const start = t.startDate ? new Date(t.startDate) : (t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt));
      const end = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + 86400000); // +1 day if no end

      // Ensure end is at least 1 hour after start to prevent errors in some gantt libs
      if (end <= start) {
        end.setTime(start.getTime() + 3600000);
      }

      return {
        start,
        end,
        name: `${t.key}: ${t.title}`,
        id: t.id,
        type: 'task',
        progress: t.status === 'Done' ? 100 : 0,
        dependencies: t.dependencies || [],
        styles: {
          backgroundColor: t.status === 'Done' ? '#10b981' : '#6366f1',
          backgroundSelectedColor: '#4f46e5',
        }
      } as GanttTask;
    });
  }, [tasksQ.data?.tasks]);

  const handleTaskChange = (task: GanttTask) => {
    updateTaskMutation.mutate({
      id: task.id,
      start: task.start,
      end: task.end,
    });
  };

  if (!projectId || !boardId) return <p className="p-8 text-slate-600">Missing board context</p>;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Gantt Chart</h2>
          <p className="text-xs text-slate-500">Visualize task dependencies and timelines.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 p-1 shadow-sm">
          {(['Hour', 'Day', 'Week', 'Month'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setView(m)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                view === m ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-white/50 bg-white/55 shadow-xl backdrop-blur-md">
        {tasksQ.isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">Loading tasks...</div>
        ) : ganttTasks.length > 0 ? (
          <div className="h-full custom-scrollbar">
            <Gantt
              tasks={ganttTasks}
              viewMode={view}
              onDateChange={handleTaskChange}
              onProgressChange={() => {}}
              onDoubleClick={() => {}}
              onSelect={() => {}}
              listCellWidth="155px"
              columnWidth={view === ViewMode.Month ? 300 : 65}
              headerHeight={60}
              rowHeight={50}
              barCornerRadius={8}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-slate-500">No tasks with dates found.</div>
        )}
      </div>
    </div>
  );
}
