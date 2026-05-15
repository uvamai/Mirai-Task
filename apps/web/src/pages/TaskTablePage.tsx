import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import type { TaskRow } from '../features/tasks/types';

type TasksPayload = {
  tasks: TaskRow[];
};

export function TaskTablePage() {
  const { boardId } = useParams<{ boardId: string }>();

  const tasksQ = useQuery({
    queryKey: ['tasks', boardId],
    enabled: Boolean(boardId),
    queryFn: () => apiJson<TasksPayload>(`/boards/${boardId}/tasks`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Task Table</h2>
        <p className="text-xs text-slate-500">Dense view of all tasks on this board.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/50 bg-white/55 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white/40 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Key</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {tasksQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading tasks...</td>
                </tr>
              ) : tasksQ.data?.tasks.map((task) => (
                <tr key={task.id} className="hover:bg-white/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-indigo-600">{task.key}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{task.title}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${task.priority === 'P0' ? 'text-rose-600' : 'text-slate-500'}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{task.dueDate || '-'}</td>
                </tr>
              ))}
              {!tasksQ.isLoading && tasksQ.data?.tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No tasks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
