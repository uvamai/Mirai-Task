import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, apiJson } from '../api/client';
import { useAppSelector } from '../hooks';
import { TaskCreateModal } from '../features/tasks/TaskCreateModal';
import { TaskCardContextMenu } from '../features/tasks/TaskCardContextMenu';
import { isTaskIdParam } from '../features/tasks/taskDeepLinks';
import { TaskDetailPanel } from '../features/tasks/TaskDetailPanel';
import type { CustomFieldDef, TaskRow } from '../features/tasks/types';
import { Badge } from '../components/ui/Badge';
import { SlaCountdown } from '../features/tasks/SlaCountdown';
import { TagPill } from '../components/TagPill';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { FieldsPanel } from '../components/board/FieldsPanel';
import { ImportBanner } from '../components/board/ImportBanner';
import { ImportExcelModal } from './ImportExcelModal';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  EMPTY_FILTERS,
  matchesFilters,
  useSavedViews,
  type SavedView,
  type SavedViewFilters,
} from '../hooks/useSavedViews';
import {
  applySavedViewColumnSnapshot,
  prefsDifferFromDefaults,
  useViewColumnPrefs,
  type BoardCardFieldKey,
} from '../hooks/useViewColumnPrefs';

function assigneeInitials(task: TaskRow): string {
  if (task.assigneeType === 'user' && task.assigneeId) return task.assigneeId.replace(/-/g, '').slice(-2).toUpperCase();
  if (task.assigneeType === 'agent') return 'AG';
  return '—';
}

function SortableTaskCard({
  task,
  onOpen,
  dense,
  estimateUnit,
  fieldShow,
  projectId,
  boardId,
  shellPathname,
  canDuplicate,
  onDuplicate,
  onToast,
  workflowColumns,
  onMoveTaskStatus,
}: {
  task: TaskRow;
  onOpen: (id: string) => void;
  dense: boolean;
  estimateUnit: string;
  fieldShow: Record<BoardCardFieldKey, boolean>;
  projectId: string;
  boardId: string;
  shellPathname: string;
  canDuplicate: boolean;
  onDuplicate?: (created: { id: string; key: string }) => void;
  onToast?: (message: string) => void;
  workflowColumns: string[];
  onMoveTaskStatus?: (taskId: string, status: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  const paused =
    task.slaState && typeof task.slaState === 'object' && 'paused' in task.slaState && (task.slaState as { paused?: boolean }).paused;
  const slaOverdue =
    task.slaDeadline &&
    !paused &&
    task.status !== 'Done' &&
    new Date(task.slaDeadline).getTime() < Date.now();

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueDateStr = task.dueDate ? String(task.dueDate).slice(0, 10) : null;
  const dueDateOverdue = dueDateStr && dueDateStr < todayStr && task.status !== 'Done';
  const dueDateToday = dueDateStr && dueDateStr === todayStr && task.status !== 'Done';
  const overdue = slaOverdue || dueDateOverdue;

  // Priority ring styling
  const priorityRing =
    task.priority === 'P0' ? 'ring-2 ring-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' :
    task.priority === 'P1' ? 'ring-1 ring-orange-300' :
    overdue ? 'ring-1 ring-rose-300' :
    'ring-1 ring-slate-200/60';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-testid="board-card"
      data-task-key={task.key}
      data-task-status={task.status}
      data-priority={task.priority}
      className={`glass-card flex gap-1 rounded-xl px-2 transition ${
        dense ? 'py-1.5' : 'py-2'
      } ${overdue ? 'border-rose-200 bg-rose-50/30' : 'border-white/60'} ${priorityRing}`}
    >
      <button
        type="button"
        data-testid="board-card-drag-handle"
        className="cursor-grab touch-none px-0.5 text-slate-400 hover:text-slate-700"
        aria-label="Drag to reorder"
        {...listeners}
      >
        ⋮⋮
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task.id)}>
        <div className="flex flex-wrap items-center gap-1">
          {task.type && task.type !== 'task' && (
            <Badge tone="indigo">{task.type}</Badge>
          )}
          {fieldShow.key && <span className="text-xs font-semibold text-indigo-700">{task.key}</span>}
          {fieldShow.priority && (
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              task.priority === 'P0' ? 'bg-red-100 text-red-700' :
              task.priority === 'P1' ? 'bg-orange-100 text-orange-700' :
              task.priority === 'P2' ? 'bg-amber-100 text-amber-700' :
              task.priority === 'P3' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
            }`}>{task.priority}</span>
          )}
          {fieldShow.estimate && task.estimate != null && (
            <Badge tone="default">
              {task.estimate} {estimateUnit}
            </Badge>
          )}
          {fieldShow.tags &&
            (task.tags ?? []).slice(0, 2).map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          {fieldShow.tags && (task.tags?.length ?? 0) > 2 && <Badge tone="default">+{task.tags!.length - 2}</Badge>}
        </div>
        <div className={`font-medium text-slate-900 ${dense ? 'text-xs' : 'text-sm'}`}>{task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {fieldShow.assignee && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/60 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200/40"
              title={task.assigneeId ?? ''}
            >
              {assigneeInitials(task)}
            </span>
          )}
          {fieldShow.sla && <SlaCountdown slaDeadline={task.slaDeadline} paused={Boolean(paused)} />}
          {fieldShow.deps && (task.dependencies?.length ?? 0) > 0 && (
            <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600" title="Dependencies">
              {task.dependencies!.length} dep
            </span>
          )}
        </div>
        {fieldShow.dueDate && task.dueDate && (
          <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold ${
            dueDateOverdue ? 'text-rose-600' : dueDateToday ? 'text-amber-600' : 'text-slate-400'
          }`}>
            {dueDateOverdue && <span>⚠</span>}
            {dueDateToday && <span>●</span>}
            Due {dueDateStr}
          </div>
        )}
      </button>
      <TaskCardContextMenu
        task={task}
        projectId={projectId}
        boardId={boardId}
        shellPathname={shellPathname}
        canDuplicate={canDuplicate}
        onOpen={onOpen}
        onDuplicate={onDuplicate}
        onToast={onToast}
        workflowColumns={workflowColumns}
        onMoveToStatus={
          onMoveTaskStatus ? (status) => onMoveTaskStatus(task.id, status) : undefined
        }
      />
    </div>
  );
}

function BoardColumn({
  col,
  widthPx,
  onResizeRightEdge,
  onAddTask,
  children,
}: {
  col: string;
  widthPx: number;
  onResizeRightEdge: (e: React.MouseEvent) => void;
  onAddTask?: (status: string) => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col });
  return (
    <div className="flex shrink-0" style={{ width: widthPx + 8 }}>
      <div
        ref={setNodeRef}
        role="list"
        aria-label={`Column ${col}`}
        data-testid="board-column"
        data-column={col}
        className={`flex min-h-[320px] min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-white/50 bg-white/50 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-md ${
          isOver ? 'ring-2 ring-indigo-400/60' : ''
        }`}
      >
        <h3 className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-600">{col}</h3>
        <div className="min-h-[120px] max-h-[min(68vh,600px)] flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {children}
          {onAddTask && (
            <button
              onClick={() => onAddTask(col)}
              className="mt-2 w-full rounded-lg border border-transparent py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              + Add Task
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label={`Resize column ${col}`}
        onMouseDown={onResizeRightEdge}
        className="w-2 shrink-0 cursor-col-resize rounded-full border border-transparent hover:border-indigo-300 hover:bg-indigo-100/80"
      />
    </div>
  );
}

type TasksPayload = {
  tasks: TaskRow[];
  estimateMode?: string;
  estimateUnitLabel?: string;
  workflowStages?: string[];
  customFieldDefs?: CustomFieldDef[];
};

type RecurringRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  frequency: string;
  intervalCount: number;
  nextRunAt: string;
  active: boolean;
};

function BoardRecurringPanel({
  projectId,
  boardId,
  columns,
  canManage,
  open,
  onClose,
}: {
  projectId: string;
  boardId: string;
  columns: string[];
  canManage: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('Recurring checklist');
  const [status, setStatus] = useState(columns[0] ?? 'Backlog');
  const [priority, setPriority] = useState('P3');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const rulesQ = useQuery({
    queryKey: ['recurring-rules', projectId, boardId],
    enabled: canManage && Boolean(projectId && boardId),
    queryFn: () =>
      apiJson<{ rules: RecurringRow[] }>(`/projects/${projectId}/boards/${boardId}/recurring-rules`),
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}/boards/${boardId}/recurring-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          status,
          priority,
          frequency,
          intervalCount,
          startDate,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recurring-rules', projectId, boardId] });
      setTitle('Recurring checklist');
    },
  });

  const delRule = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/projects/${projectId}/boards/${boardId}/recurring-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? 'Delete failed');
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['recurring-rules', projectId, boardId] }),
  });

  if (!canManage || !open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Recurring tasks</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
      <div className="w-[500px] max-w-full space-y-4">
        <p className="text-sm text-slate-600">
          Schedule repeating operational work. (Creates a task on each run.)
        </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[140px] flex-1 flex-col text-[10px] font-semibold uppercase text-slate-500">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Column
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          >
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          >
            {['P0', 'P1', 'P2', 'P3', 'P4'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Every
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
            className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          >
            <option value="daily">Day(s)</option>
            <option value="weekly">Week(s)</option>
            <option value="monthly">Month(s)</option>
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Interval
          <input
            type="number"
            min={1}
            max={12}
            value={intervalCount}
            onChange={(e) => setIntervalCount(Number(e.target.value) || 1)}
            className="mt-0.5 w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase text-slate-500">
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case"
          />
        </label>
        <button
          type="button"
          disabled={!title.trim() || createRule.isPending}
          onClick={() => createRule.mutate()}
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Add rule
        </button>
      </div>
      {createRule.isError && <p className="mt-2 text-xs text-rose-700">{(createRule.error as Error).message}</p>}
      <ul className="mt-3 space-y-2">
        {(rulesQ.data?.rules ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/70 px-3 py-2 text-xs">
            <span>
              <span className="font-semibold text-slate-900">{r.title}</span>
              <span className="text-slate-600">
                {' '}
                — {r.frequency} ×{r.intervalCount} · {r.status} · next {new Date(r.nextRunAt).toLocaleString()}
              </span>
            </span>
            <button
              type="button"
              className="text-rose-700 hover:underline"
              onClick={() => delRule.mutate(r.id)}
              disabled={delRule.isPending}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      </div>
      </div>
    </div>
  );
}

export function BoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [fieldsEmphasis, setFieldsEmphasis] = useState<'list' | 'board'>('board');
  const taskParam = searchParams.get('task');
  const selectedTaskId = useMemo(() => (isTaskIdParam(taskParam) ? taskParam : null), [taskParam]);

  const openTask = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set('task', id);
          return n;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const closeTask = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('task');
        return n;
      },
      { replace: true }
    );
  }, [setSearchParams]);
  const [filters, setFilters] = useState<SavedViewFilters>(EMPTY_FILTERS);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const savedViews = useSavedViews(boardId);
  const columnPrefs = useViewColumnPrefs(boardId);
  const layoutDirty = useMemo(() => {
    const d = prefsDifferFromDefaults(columnPrefs.prefs);
    return d.list || d.board;
  }, [columnPrefs.prefs]);
  const [density, setDensity] = useState<'comfortable' | 'dense'>(() => {
    const v = localStorage.getItem('mirai_board_density');
    return v === 'dense' ? 'dense' : 'comfortable';
  });
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const [editColsOpen, setEditColsOpen] = useState(false);
  const [stagesDraft, setStagesDraft] = useState('');
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplKey, setTplKey] = useState('');
  const [tplLabel, setTplLabel] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const colEditTextareaRef = useRef<HTMLTextAreaElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const meQ = useQuery({
    queryKey: ['me-board'],
    queryFn: () => apiJson<{ membership: { role: string }; user: { id: string } }>('/auth/me'),
  });

  const boardQ = useQuery({
    queryKey: ['board-meta', projectId, boardId],
    enabled: Boolean(projectId && boardId),
    queryFn: () =>
      apiJson<{ id: string; name: string; settings: Record<string, unknown> }>(`/projects/${projectId}/boards/${boardId}`),
  });

  const stagesQ = useQuery({
    queryKey: ['kanban-stages', projectId, boardId],
    enabled: Boolean(projectId && boardId),
    queryFn: () =>
      apiJson<{ defaultStages: string[]; customStages: string[] | null }>(
        `/projects/${projectId}/kanban-stages${boardId ? `?boardId=${encodeURIComponent(boardId)}` : ''}`
      ),
  });

  const tasksQ = useQuery({
    queryKey: ['tasks', boardId],
    enabled: Boolean(boardId),
    queryFn: () => apiJson<TasksPayload>(`/boards/${boardId}/tasks`),
  });

  useEffect(() => {
    const cw = boardQ.data?.settings?.columnWidths as Record<string, unknown> | undefined;
    if (cw && typeof cw === 'object' && !Array.isArray(cw)) {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(cw)) {
        const n = Number(v);
        if (Number.isFinite(n)) next[k] = n;
      }
      setColWidths(next);
    }
  }, [boardQ.data]);

  useEffect(() => {
    if (!editColsOpen) return;
    colEditTextareaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditColsOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editColsOpen]);

  const editColsDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(editColsDialogRef, editColsOpen);
  const saveTplDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(saveTplDialogRef, saveTplOpen);
  useEffect(() => {
    if (!saveTplOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSaveTplOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saveTplOpen]);

  const estimateMode = (tasksQ.data?.estimateMode ?? 'story_points') as 'story_points' | 'hours';
  const estimateUnit = tasksQ.data?.estimateUnitLabel ?? 'pts';

  const columns = useMemo(() => {
    const d = stagesQ.data;
    if (!d) return [];
    return d.customStages && d.customStages.length > 0 ? d.customStages : [...d.defaultStages];
  }, [stagesQ.data]);

  const widthFor = useCallback(
    (col: string) => {
      const w = colWidths[col];
      return typeof w === 'number' && w >= 160 && w <= 960 ? w : 256;
    },
    [colWidths]
  );

  const patchBoardSettings = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      const res = await apiFetch(`/projects/${projectId}/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Board update failed');
      return b;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['board-meta', projectId, boardId] });
      void qc.invalidateQueries({ queryKey: ['kanban-stages', projectId, boardId] });
    },
    onError: (e: Error) => {
      setToast(e.message);
      setTimeout(() => setToast(null), 4000);
    },
  });

  const saveAsOrgTemplate = useMutation({
    mutationFn: async () => {
      const key = tplKey.trim();
      if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
        throw new Error('Template key must start with a letter; then lowercase letters, digits, or underscores (2–64 chars).');
      }
      const label = tplLabel.trim();
      if (!label) throw new Error('Label is required');
      const cur = await apiJson<{ settings: Record<string, unknown> }>('/tenant/settings');
      const existingRaw = cur.settings.customBoardTemplates;
      const existing = Array.isArray(existingRaw) ? [...(existingRaw as { templateKey?: string }[])] : [];
      const next = [
        ...existing.filter((x) => x && typeof x === 'object' && x.templateKey !== key),
        {
          templateKey: key,
          label,
          description: tplDescription.trim() || `Saved from board “${boardQ.data?.name ?? ''}”`,
          businessType: 'custom',
          defaultStages: [...columns],
          defaultEstimateMode: estimateMode,
          sampleTasks: [] as { title: string; status: string; priority: string }[],
        },
      ];
      const res = await apiFetch('/tenant/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customBoardTemplates: next }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Save failed');
    },
    onSuccess: () => {
      setSaveTplOpen(false);
      void qc.invalidateQueries({ queryKey: ['board-templates'] });
      setToast('Template saved to organization — pick it when creating a project.');
      setTimeout(() => setToast(null), 5000);
    },
    onError: (e: Error) => {
      setToast(e.message);
      setTimeout(() => setToast(null), 5000);
    },
  });

  const startColumnResize = useCallback(
    (col: string, clientX: number, startW: number) => {
      function onMove(ev: MouseEvent) {
        const dx = ev.clientX - clientX;
        const next = Math.min(960, Math.max(160, startW + dx));
        setColWidths((prev) => ({ ...prev, [col]: next }));
      }
      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        void patchBoardSettings.mutateAsync({ columnWidths: { ...colWidthsRef.current } }).catch(() => undefined);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [patchBoardSettings]
  );

  const tasksByStatus = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const c of columns) m.set(c, []);
    for (const t of tasksQ.data?.tasks ?? []) {
      if (!matchesFilters(t, filters)) continue;
      const list = m.get(t.status) ?? [];
      list.push(t);
      m.set(t.status, list);
    }
    for (const [, list] of m) list.sort((a, b) => a.position - b.position);
    return m;
  }, [columns, tasksQ.data?.tasks, filters]);

  const patchTask = useMutation({
    mutationFn: async (args: { taskId: string; status?: string; position?: number }) => {
      const body: Record<string, unknown> = {};
      if (args.status !== undefined) body.status = args.status;
      if (args.position !== undefined) body.position = args.position;
      const res = await apiFetch(`/tasks/${args.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Update failed');
      return b;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks', boardId] }),
    onError: (e: Error) => {
      setToast(e.message);
      setTimeout(() => setToast(null), 4000);
    },
  });

  const patchPositions = useMutation({
    mutationFn: async (ordered: TaskRow[]) => {
      const base = Date.now();
      await Promise.all(
        ordered.map((t, i) =>
          apiFetch(`/tasks/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position: base + i }),
          }).then(async (res) => {
            if (!res.ok) {
              const b = await res.json().catch(() => ({}));
              throw new Error((b as { error?: string }).error ?? 'Position update failed');
            }
          })
        )
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks', boardId] }),
    onError: (e: Error) => {
      setToast(e.message);
      setTimeout(() => setToast(null), 4000);
    },
  });

  useEffect(() => {
    if (!boardId || !accessToken || import.meta.env.VITE_SOCKET_ENABLED !== 'true') return;
    const socket: Socket = io({
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['websocket'],
    });
    socket.connect();
    socket.emit('board:subscribe', boardId, () => undefined);
    socket.on('board:updated', (p: { boardId?: string }) => {
      if (p.boardId === boardId) void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    });
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [boardId, accessToken, qc]);

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || !boardId || !tasksQ.data) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const tasks = tasksQ.data.tasks;
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    if (activeId === overId) return;

    if (columns.includes(overId)) {
      if (activeTask.status !== overId) {
        patchTask.mutate({ taskId: activeId, status: overId });
      }
      return;
    }

    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (activeTask.status !== overTask.status) {
      patchTask.mutate({ taskId: activeId, status: overTask.status });
      return;
    }

    const colTasks = [...(tasksByStatus.get(activeTask.status) ?? [])];
    const oldIndex = colTasks.findIndex((t) => t.id === activeId);
    const newIndex = colTasks.findIndex((t) => t.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const reordered = arrayMove(colTasks, oldIndex, newIndex);
    patchPositions.mutate(reordered);
  }

  const role = meQ.data?.membership.role ?? '';
  const canCreate = role === 'ADMIN' || role === 'MANAGER';
  const canManageBoard = canCreate;
  const isAdmin = role === 'ADMIN';

  function openColumnEditor() {
    setStagesDraft(columns.join('\n'));
    setEditColsOpen(true);
  }

  function openSaveTemplate() {
    const base = boardQ.data?.name?.replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_+|_+$/g, '') ?? 'board';
    setTplKey(base.slice(0, 40) || 'my_board');
    setTplLabel(boardQ.data?.name ? `${boardQ.data.name} template` : 'Saved board template');
    setTplDescription('');
    setSaveTplOpen(true);
  }

  function saveColumnEditor() {
    const stages = stagesDraft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (stages.length < 3) {
      setToast('Need at least 3 column names');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    patchBoardSettings.mutate(
      { kanbanStages: stages },
      {
        onSuccess: () => {
          setEditColsOpen(false);
          void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
        },
      }
    );
  }

  if (!projectId || !boardId) return <p className="text-slate-600">Missing board</p>;

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col gap-3">
      <BoardToolbar
        canManageBoard={canManageBoard}
        isAdmin={isAdmin}
        canCreate={canCreate}
        density={density}
        onDensity={(d) => {
          setDensity(d);
          localStorage.setItem('mirai_board_density', d);
        }}
        onEditColumns={openColumnEditor}
        onSaveTemplate={openSaveTemplate}
        onNewTask={() => setCreateOpen(true)}
        filters={filters}
        onFilters={(next) => {
          setFilters(next);
          setActiveViewId(null);
        }}
        views={savedViews.views}
        activeViewId={activeViewId}
        onApplyView={(view: SavedView | null) => {
          if (!view) {
            setFilters(EMPTY_FILTERS);
            setActiveViewId(null);
            return;
          }
          setFilters(view.filters);
          setActiveViewId(view.id);
          if (boardId) {
            applySavedViewColumnSnapshot(boardId, {
              listColumns: view.listColumns,
              boardCardFields: view.boardCardFields,
            });
            columnPrefs.reload();
          }
        }}
        onSaveView={(name) => {
          const saved = savedViews.saveView(name, filters, {
            listColumns: { ...columnPrefs.prefs.list },
            boardCardFields: { ...columnPrefs.prefs.board },
          });
          setActiveViewId(saved.id);
        }}
        onDeleteView={(id) => {
          savedViews.deleteView(id);
          if (activeViewId === id) setActiveViewId(null);
        }}
        onOpenFieldsPanel={() => {
          setFieldsEmphasis('board');
          setFieldsPanelOpen(true);
        }}
        canSaveView={filters.search.length > 0 || filters.priorities.length > 0 || layoutDirty}
        fieldToggleSurface="board"
        boardCardVisibility={columnPrefs.prefs.board}
        onToggleBoardCard={columnPrefs.toggleBoard}
      />

      <FieldsPanel
        open={fieldsPanelOpen}
        onClose={() => setFieldsPanelOpen(false)}
        workflowStages={columns}
        list={columnPrefs.prefs.list}
        board={columnPrefs.prefs.board}
        onToggleList={columnPrefs.toggleList}
        onToggleBoard={columnPrefs.toggleBoard}
        onResetDefaults={columnPrefs.resetDefaults}
        emphasis={fieldsEmphasis}
      />

      <ImportBanner
        projectId={projectId}
        boardId={boardId}
        boardSettings={boardQ.data?.settings}
        canManage={canManageBoard}
      />

      {editColsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditColsOpen(false);
          }}
        >
          <div
            ref={editColsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="col-edit-title"
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/60 bg-white p-5 shadow-xl"
          >
            <h2 id="col-edit-title" className="text-lg font-bold text-slate-900">
              Board columns
            </h2>
            <p className="mt-1 text-xs text-slate-600">One column name per line (3–32 columns). Existing tasks should use these status names.</p>
            <textarea
              ref={colEditTextareaRef}
              value={stagesDraft}
              onChange={(e) => setStagesDraft(e.target.value)}
              rows={10}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              aria-label="Column names, one per line"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setEditColsOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={patchBoardSettings.isPending}
                onClick={saveColumnEditor}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {saveTplOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSaveTplOpen(false);
          }}
        >
          <div
            ref={saveTplDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-tpl-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-5 shadow-xl"
          >
            <h2 id="save-tpl-title" className="text-lg font-bold text-slate-900">
              Save board as organization template
            </h2>
            <p className="mt-1 text-xs text-slate-600">Adds to custom templates (admin). Uses current columns and estimate mode.</p>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Template key</label>
            <input
              value={tplKey}
              onChange={(e) => setTplKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              placeholder="e.g. my_support_board"
              autoComplete="off"
            />
            <label className="mt-3 block text-xs font-semibold text-slate-600">Label</label>
            <input
              value={tplLabel}
              onChange={(e) => setTplLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-semibold text-slate-600">Description (optional)</label>
            <input
              value={tplDescription}
              onChange={(e) => setTplDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            {saveAsOrgTemplate.isError && (
              <p className="mt-2 text-xs text-rose-700">{(saveAsOrgTemplate.error as Error).message}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={() => setSaveTplOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saveAsOrgTemplate.isPending}
                onClick={() => saveAsOrgTemplate.mutate()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save template
              </button>
            </div>
          </div>
        </div>
      )}

      {searchParams.has('search') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Search tasks</h2>
              <button 
                onClick={() => {
                  setSearchParams((prev) => {
                    const n = new URLSearchParams(prev);
                    n.delete('search');
                    return n;
                  }, { replace: true });
                }} 
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
        <div className="w-[500px] max-w-full space-y-4">
          <input
            autoFocus
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search title or key (MIRAI-…)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setSearchParams((prev) => {
                  const n = new URLSearchParams(prev);
                  n.delete('search');
                  return n;
                }, { replace: true });
              }}
            >
              Done
            </button>
          </div>
        </div>
        </div>
        </div>
      )}

      <BoardRecurringPanel
        projectId={projectId}
        boardId={boardId}
        columns={columns}
        canManage={canManageBoard}
        open={searchParams.has('recurring')}
        onClose={() => {
          setSearchParams((prev) => {
            const n = new URLSearchParams(prev);
            n.delete('recurring');
            return n;
          }, { replace: true });
        }}
      />

      <TaskCreateModal
        boardId={boardId}
        estimateMode={estimateMode}
        columns={columns}
        customFieldDefs={tasksQ.data?.customFieldDefs ?? []}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void qc.invalidateQueries({ queryKey: ['tasks', boardId] })}
      />

      <ImportExcelModal
        projectId={projectId}
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          void qc.invalidateQueries({ queryKey: ['projects'] });
          void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
        }}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        boardId={boardId}
        columns={tasksQ.data?.workflowStages?.length ? tasksQ.data.workflowStages : columns}
        membershipRole={role}
        userId={meQ.data?.user.id}
        estimateMode={estimateMode}
        onClose={closeTask}
      />

      {toast && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{toast}</div>
      )}

      {tasksQ.isLoading || stagesQ.isLoading || meQ.isLoading || boardQ.isLoading ? (
        <p className="text-slate-600">Loading board…</p>
      ) : (tasksQ.data?.tasks?.length ?? 0) === 0 ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/50 bg-white/70 p-8 text-center shadow-sm backdrop-blur-md">
          <h3 className="text-base font-bold text-slate-900">No tasks on this board yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Add tasks one-by-one, or skip ahead by importing an existing spreadsheet. Each Excel/CSV file
            becomes its own board with your columns mapped to status, priority, assignee, due date, and tags.
          </p>
          {canCreate && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                + New task
              </button>
              {canManageBoard && (
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Import from Excel
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-1 overflow-x-auto pb-4">
            {columns.map((col) => {
              const colTasks = tasksByStatus.get(col) ?? [];
              const ids = colTasks.map((t) => t.id);
              const w = widthFor(col);
              return (
                <BoardColumn
                  key={col}
                  col={col}
                  widthPx={w}
                  onResizeRightEdge={(e) => {
                    e.preventDefault();
                    startColumnResize(col, e.clientX, w);
                  }}
                  onAddTask={canCreate ? () => {
                    // Ideally we'd set default status in modal, but for now just open modal
                    setCreateOpen(true);
                  } : undefined}
                >
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {colTasks.map((t) => (
                      <SortableTaskCard
                        key={t.id}
                        task={t}
                        dense={density === 'dense'}
                        estimateUnit={estimateUnit}
                        fieldShow={columnPrefs.prefs.board}
                        boardId={boardId}
                        shellPathname={location.pathname}
                        canDuplicate={canCreate}
                        onOpen={openTask}
                        onDuplicate={(c) => {
                          void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
                          openTask(c.id);
                        }}
                        onToast={(msg) => {
                          setToast(msg);
                          setTimeout(() => setToast(null), 4000);
                        }}
                        workflowColumns={columns}
                        projectId={projectId}
                        onMoveTaskStatus={async (taskId, status) => {
                          await patchTask.mutateAsync({ taskId, status });
                        }}
                      />
                    ))}
                  </SortableContext>
                </BoardColumn>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}
