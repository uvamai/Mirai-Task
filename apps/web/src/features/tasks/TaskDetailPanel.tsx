import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { apiFetch, apiJson } from '../../api/client';
import type { ActivityRow, CustomFieldDef, EmployeeOption, TaskRow } from './types';
import { SlaCountdown } from './SlaCountdown';
import { TagPill } from '../../components/TagPill';
import { useTagCatalog } from '../../hooks/useTagCatalog';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCommentBody, type MentionDisplay } from './formatMentions';

function estimateSchema(mode: 'story_points' | 'hours') {
  if (mode === 'hours') {
    return Yup.number()
      .min(0)
      .nullable()
      .transform((v, orig) => (orig === '' || orig === undefined || Number.isNaN(v) ? null : v))
      .test('half', 'Use 0.5 hour steps', (v) => v == null || Math.abs(Math.round(v * 2) - v * 2) < 1e-9);
  }
  return Yup.number()
    .integer()
    .min(0)
    .max(100)
    .nullable()
    .transform((v, orig) => (orig === '' || orig === undefined || Number.isNaN(v) ? null : v));
}

type DetailResponse = {
  task: TaskRow & {
    projectId: string;
    boardId?: string;
    dependencies?: string[];
    parentTaskId?: string | null;
    parent?: { id: string; key: string; title: string } | null;
    subtasks?: { id: string; key: string; title: string; status: string }[];
    estimateMode?: string;
    estimateUnitLabel?: string;
    workflowStages?: string[];
    customFieldDefs?: CustomFieldDef[];
  };
  activity: ActivityRow[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDepIds(raw: string): string[] {
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
}

function isoToDatetimeLocal(iso: unknown): string {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  taskId: string | null;
  boardId: string;
  columns: string[];
  membershipRole: string;
  userId: string | undefined;
  estimateMode: 'story_points' | 'hours';
  onClose: () => void;
};

export function TaskDetailPanel({
  taskId,
  boardId,
  columns,
  membershipRole,
  userId,
  estimateMode,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const canManage = membershipRole === 'ADMIN' || membershipRole === 'MANAGER';
  const tagCatalogQ = useTagCatalog();
  const catalog = tagCatalogQ.data ?? [];
  const [tagInput, setTagInput] = useState('');
  const [relatedUuid, setRelatedUuid] = useState('');
  const [relatedErr, setRelatedErr] = useState<string | null>(null);
  const { projectId } = useParams<{ projectId: string }>();

  const detailQ = useQuery({
    queryKey: ['task', taskId],
    enabled: Boolean(taskId),
    queryFn: () => apiJson<DetailResponse>(`/tasks/${taskId}`),
  });

  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, Boolean(taskId));

  /** Close on Escape while the modal is open. */
  useEffect(() => {
    if (!taskId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [taskId, onClose]);

  const tags = useMemo(
    () => (detailQ.data?.task?.tags ?? []).filter((t) => typeof t === 'string' && t.trim()),
    [detailQ.data?.task?.tags]
  );

  const employeesQ = useQuery({
    queryKey: ['employees-picker'],
    enabled: Boolean(taskId),
    queryFn: () => apiJson<{ employees: EmployeeOption[] }>('/employees'),
  });

  const patchTask = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Update failed');
      return b;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const assignTask = useMutation({
    mutationFn: async (payload: { assigneeType: string; assigneeId: string }) => {
      const res = await apiFetch(`/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Assign failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const reassignTask = useMutation({
    mutationFn: async (payload: { toType: string; toId: string; reason: string }) => {
      const res = await apiFetch(`/tasks/${taskId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Reassign failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const slaPause = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiFetch(`/tasks/${taskId}/sla/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Pause failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const slaResume = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/tasks/${taskId}/sla/resume`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Resume failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const relatedQ = useQuery({
    queryKey: ['task-related', taskId],
    enabled: Boolean(taskId),
    queryFn: () =>
      apiJson<{ related: { id: string; key: string; title: string; status: string; boardId?: string }[] }>(
        `/tasks/${taskId}/related`
      ),
  });

  const addRelatedTask = useMutation({
    mutationFn: async (toTaskId: string) => {
      if (!taskId) throw new Error('No task');
      const res = await apiFetch(`/tasks/${taskId}/related`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTaskId }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Failed to add link');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-related', taskId] });
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  const removeRelatedTask = useMutation({
    mutationFn: async (otherId: string) => {
      if (!taskId) throw new Error('No task');
      const res = await apiFetch(`/tasks/${taskId}/related/${otherId}`, { method: 'DELETE' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Failed to remove link');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-related', taskId] });
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });


  const task = detailQ.data?.task;
  const mode = (task?.estimateMode as 'story_points' | 'hours' | undefined) ?? estimateMode;
  const estLabel =
    mode === 'hours' ? 'Estimate (hours, 0.5 steps)' : 'Estimate (story points, whole numbers)';
  const wfCols = task?.workflowStages?.length ? task.workflowStages : columns;
  const defs = task?.customFieldDefs ?? [];

  const employeeOnlyEdit =
    membershipRole === 'EMPLOYEE' && task?.assigneeType === 'user' && task.assigneeId === userId;
  const canEditFields = canManage || employeeOnlyEdit;
  const canEditP0 = canManage;
  const canEditRelated = canManage || employeeOnlyEdit;

  const paused =
    task?.slaState && typeof task.slaState === 'object' && 'paused' in task.slaState && (task.slaState as { paused?: boolean }).paused;

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    const next = Array.from(new Set([...tags, t])).slice(0, 10);
    patchTask.mutate({ tags: next });
    setTagInput('');
  }

  function removeTag(raw: string) {
    const t = raw.trim();
    const next = tags.filter((x) => x.toLowerCase() !== t.toLowerCase());
    patchTask.mutate({ tags: next });
  }

  const currentAssigneeName = useMemo(() => {
    if (task?.assigneeType === 'agent') return 'AI Agent';
    if (task?.assigneeType === 'user' && task.assigneeId && employeesQ.data) {
      const emp = employeesQ.data.employees.find(e => e.userId === task.assigneeId);
      if (emp) return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
      return 'Unknown user';
    }
    return 'Unassigned';
  }, [task?.assigneeType, task?.assigneeId, employeesQ.data]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        tabIndex={-1}
        className="glass-modal-card relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
      >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-md">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900">{task ? `${task.key} · ${task.title}` : 'Task detail'}</h2>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Inspector</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => alert('Share link (coming soon)')}
          >
            Share
          </button>
          <button
            type="button"
            aria-label="Close task detail"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {detailQ.isLoading && <p className="text-sm text-slate-600">Loading…</p>}
        {detailQ.isError && <p className="text-sm text-rose-700">Could not load task.</p>}
        {task && (
          <div className="space-y-6">

            {(task.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags!.map((t) => (
                  <TagPill key={t} tag={t} />
                ))}
              </div>
            )}
            {canEditFields && (
              <div className="glass-card rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Tags</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => removeTag(t)}
                      className="rounded"
                      title="Remove tag"
                    >
                      <TagPill tag={t} />
                    </button>
                  ))}
                  {tags.length === 0 && <span className="text-xs text-slate-500">No tags</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    list="mirai-tag-suggestions"
                  />
                  <button
                    type="button"
                    disabled={!tagInput.trim() || patchTask.isPending}
                    onClick={() => addTag(tagInput)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {catalog.length > 0 && (
                  <datalist id="mirai-tag-suggestions">
                    {catalog.map((t) => (
                      <option key={t.name} value={t.name} />
                    ))}
                  </datalist>
                )}
                <p className="mt-1 text-[11px] text-slate-500">Tip: click a tag to remove it.</p>
              </div>
            )}

            {(task.parent || (task.subtasks && task.subtasks.length > 0)) && (
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs text-slate-700">
                {task.parent && (
                  <p>
                    <span className="font-semibold text-slate-600">Parent:</span>{' '}
                    <span className="font-mono text-indigo-800">{task.parent.key}</span> {task.parent.title}
                  </p>
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="mt-1">
                    <span className="font-semibold text-slate-600">Subtasks:</span>
                    <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                      {task.subtasks.map((s) => (
                        <li key={s.id}>
                          <span className="font-mono">{s.key}</span> {s.title}{' '}
                          <span className="text-slate-400">({s.status})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const assigneeControlsBlock = (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Current Assignee *</label>
                    {canManage && employeesQ.data ? (
                      <select
                        id="assign-user-inline"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm shadow-sm bg-white"
                        value={task.assigneeType === 'user' ? (task.assigneeId || '') : ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          assignTask.mutate({ assigneeType: 'user', assigneeId: v });
                        }}
                      >
                        <option value="" disabled>Assign to user…</option>
                        {employeesQ.data.employees.map((emp) => (
                          <option key={emp.userId} value={emp.userId}>
                            {emp.firstName} {emp.lastName} ({emp.email})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 w-full rounded-lg border border-transparent px-2 py-1.5 text-sm bg-slate-50">
                        {currentAssigneeName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Reassign (requires reason)</label>
                    <div className="mt-1">
                      {canManage && employeesQ.data ? (
                        <ReassignForm
                          employees={employeesQ.data.employees}
                          onSubmit={(toId, reason) => reassignTask.mutate({ toType: 'user', toId, reason })}
                          disabled={reassignTask.isPending}
                        />
                      ) : (
                        <div className="w-full rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-400 bg-slate-50">
                          Not permitted
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );

              const commentsBlock = <TaskCommentsSection taskId={taskId} boardId={boardId} />;
              
              const relatedWorkBlock = (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold uppercase text-slate-600">Related work</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Linked tasks in this project (separate from blocking dependencies in the edit form).
                  </p>
                  {relatedQ.isLoading ? (
                    <p className="mt-2 text-xs text-slate-500">Loading links…</p>
                  ) : relatedQ.isError ? (
                    <p className="mt-2 text-xs text-rose-600">Could not load related tasks.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {(relatedQ.data?.related ?? []).length === 0 ? (
                        <li className="text-xs text-slate-500">No linked tasks yet.</li>
                      ) : (
                        (relatedQ.data?.related ?? []).map((r) => (
                          <li
                            key={r.id}
                            className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              {projectId && r.boardId ? (
                                <Link
                                  to={`/app/projects/${projectId}/boards/${r.boardId}?task=${encodeURIComponent(r.id)}`}
                                  className="font-semibold text-indigo-700 hover:text-indigo-900"
                                  onClick={() => onClose()}
                                >
                                  {r.key}
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-800">{r.key}</span>
                              )}
                              <span className="text-slate-600"> · {r.status}</span>
                              <div className="truncate text-slate-600">{r.title}</div>
                            </div>
                            {canEditRelated && (
                              <button
                                type="button"
                                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                disabled={removeRelatedTask.isPending}
                                aria-label={`Remove link to ${r.key}`}
                                onClick={() => removeRelatedTask.mutate(r.id)}
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                  {canEditRelated && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={relatedUuid}
                        onChange={(e) => {
                          setRelatedUuid(e.target.value);
                          setRelatedErr(null);
                        }}
                        placeholder="Other task UUID (same project)"
                        className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                      />
                      <button
                        type="button"
                        disabled={addRelatedTask.isPending || !UUID_RE.test(relatedUuid.trim())}
                        onClick={() => {
                          const id = relatedUuid.trim();
                          addRelatedTask.mutate(id, {
                            onSuccess: () => {
                              setRelatedUuid('');
                              setRelatedErr(null);
                            },
                            onError: (e) => setRelatedErr((e as Error).message),
                          });
                        }}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Link task
                      </button>
                    </div>
                  )}
                  {relatedErr && <p className="mt-2 text-xs text-rose-600">{relatedErr}</p>}
                </div>
              );

              const activityBlock = (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold uppercase text-slate-600">Activity</h3>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                    {detailQ.data?.activity.map((a) => (
                      <li key={a.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="font-semibold text-slate-800">{a.action}</span>
                        <span className="text-slate-500">
                          {' '}·{' '}
                          {a.actorType === 'user' && a.actorUser
                            ? `${a.actorUser.firstName || ''} ${a.actorUser.lastName || ''}`.trim() || a.actorUser.email
                            : a.actorType}
                        </span>
                        <div className="text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              );

              const slaControlsBlock = canManage ? (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold uppercase text-slate-600">SLA controls</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={slaPause.isPending}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"
                      onClick={() => {
                        const reason = window.prompt('Pause reason?');
                        if (reason) slaPause.mutate(reason);
                      }}
                    >
                      Pause SLA
                    </button>
                    <button
                      type="button"
                      disabled={slaResume.isPending}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium"
                      onClick={() => slaResume.mutate()}
                    >
                      Resume SLA
                    </button>
                  </div>
                </div>
              ) : null;

              const slaBlock = (
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">SLA</span>
                    <SlaCountdown slaDeadline={task.slaDeadline} paused={Boolean(paused)} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Deadline: {task.slaDeadline ? new Date(task.slaDeadline).toLocaleString() : '—'}
                  </p>
                  {paused && <p className="mt-1 text-amber-700">Paused</p>}
                  {task.slaState &&
                    typeof task.slaState === 'object' &&
                    'blockedReason' in task.slaState &&
                    (task.slaState as { blockedReason?: string }).blockedReason && (
                      <p className="mt-1 text-xs text-rose-800">
                        Blocked: {(task.slaState as { blockedReason: string }).blockedReason}
                      </p>
                    )}
                </div>
              );

              const csatBlock = <TaskCsatSection taskId={taskId} boardId={boardId} task={task} />;

              return canEditFields ? (
                <Formik
                  enableReinitialize
                  initialValues={{
                    title: task.title,
                    description: task.description ?? '',
                    priority: task.priority,
                    status: task.status,
                    estimate: task.estimate ?? ('' as const),
                    resolution: task.resolution ?? '',
                    startDate: task.startDate ? String(task.startDate).slice(0, 10) : '',
                    dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : '',
                    parentTaskId: task.parentTaskId ?? '',
                    dependenciesText: (task.dependencies ?? []).join(', '),
                    metadata: {
                      ...(Object.fromEntries(
                        defs.map((d) => {
                          const cur = task.metadata?.[d.key];
                          if (d.type === 'number') return [d.key, cur === null || cur === undefined ? '' : String(cur)];
                          return [d.key, cur == null ? '' : String(cur)];
                        })
                      ) as Record<string, string>),
                      itsmMajorIncidentId:
                        task.metadata?.itsmMajorIncidentId != null ? String(task.metadata.itsmMajorIncidentId) : '',
                      itsmProblemId: task.metadata?.itsmProblemId != null ? String(task.metadata.itsmProblemId) : '',
                      changeWindowStart: isoToDatetimeLocal(task.metadata?.changeWindowStart),
                      changeWindowEnd: isoToDatetimeLocal(task.metadata?.changeWindowEnd),
                    },
                  }}
                  validationSchema={Yup.object({
                    title: Yup.string().min(1).max(512).required('Title is required'),
                    description: Yup.string().max(8000).required('Description is required'),
                    priority: Yup.string().oneOf(['P0', 'P1', 'P2', 'P3', 'P4']).required(),
                    status: Yup.string().required(),
                    estimate: estimateSchema(mode),
                    resolution: Yup.string().max(8000).nullable(),
                    startDate: Yup.string().required('Start date is required'),
                    dueDate: Yup.string().required('Due date is required'),
                    parentTaskId: Yup.string()
                      .nullable()
                      .transform((v) => (v === '' || v === undefined ? '' : String(v).trim()))
                      .test('uuid', 'Invalid parent UUID', (v) => !v || UUID_RE.test(v)),
                    dependenciesText: Yup.string().max(4000).nullable(),
                    metadata: Yup.object({
                      ...Object.fromEntries(
                        defs.map((d) => {
                          if (d.type === 'text') return [d.key, Yup.string().max(2000).nullable()];
                          if (d.type === 'number')
                            return [
                              d.key,
                              Yup.number().nullable().transform((v, orig) => (orig === '' ? null : v)),
                            ];
                          const opts = [...(d.options ?? []), '', null] as (string | null)[];
                          return [d.key, Yup.string().nullable().oneOf(opts)];
                        })
                      ),
                      itsmMajorIncidentId: Yup.string()
                        .nullable()
                        .transform((v) => (v === '' ? '' : v))
                        .test('uuid', 'Invalid UUID', (v) => !v || UUID_RE.test(v)),
                      itsmProblemId: Yup.string()
                        .nullable()
                        .transform((v) => (v === '' ? '' : v))
                        .test('uuid', 'Invalid UUID', (v) => !v || UUID_RE.test(v)),
                      changeWindowStart: Yup.string().nullable(),
                      changeWindowEnd: Yup.string().nullable(),
                    }),
                  })}
                  onSubmit={async (values, { setStatus }) => {
                    setStatus(undefined);
                    if (!canEditP0 && values.priority === 'P0' && task.priority !== 'P0') {
                      setStatus('Only Admin/Manager can set P0');
                      return;
                    }
                    const metaOut: Record<string, unknown> = { ...(task.metadata ?? {}) };
                    const md = values.metadata as Record<string, string | number | undefined>;
                    for (const d of defs) {
                      const raw = md[d.key];
                      if (d.type === 'number') {
                        metaOut[d.key] = raw === '' || raw === undefined ? null : Number(raw);
                      } else {
                        metaOut[d.key] = raw === '' ? null : raw;
                      }
                    }
                    const mi = String(md.itsmMajorIncidentId ?? '').trim();
                    metaOut.itsmMajorIncidentId = mi && UUID_RE.test(mi) ? mi : null;
                    const pr = String(md.itsmProblemId ?? '').trim();
                    metaOut.itsmProblemId = pr && UUID_RE.test(pr) ? pr : null;
                    const cws = String(md.changeWindowStart ?? '').trim();
                    const cwe = String(md.changeWindowEnd ?? '').trim();
                    metaOut.changeWindowStart = cws ? new Date(cws).toISOString() : null;
                    metaOut.changeWindowEnd = cwe ? new Date(cwe).toISOString() : null;
                    const start =
                      values.startDate && String(values.startDate).trim() !== ''
                        ? String(values.startDate).slice(0, 10)
                        : null;
                    const due =
                      values.dueDate && String(values.dueDate).trim() !== ''
                        ? String(values.dueDate).slice(0, 10)
                        : null;
                    const ptRaw = String(values.parentTaskId ?? '').trim();
                    const nextParent = ptRaw === '' ? null : ptRaw;
                    const prevParent = task.parentTaskId ?? null;
                    try {
                      const body: Record<string, unknown> = {
                        title: values.title,
                        description: values.description || null,
                        priority: values.priority,
                        status: values.status,
                        estimate: values.estimate === '' ? null : Number(values.estimate),
                        resolution: values.resolution?.trim() ? values.resolution.trim() : null,
                        startDate: start,
                        dueDate: due,
                        dependencies: parseDepIds(values.dependenciesText ?? ''),
                        metadata: metaOut,
                      };
                      if (prevParent !== nextParent) {
                        body.parentTaskId = nextParent;
                      }
                      await patchTask.mutateAsync(body);
                    } catch (e) {
                      setStatus((e as Error).message);
                    }
                  }}
                >
                  {({ isSubmitting, status }) => (
                    <Form className="space-y-3">
                      {/* 1. Title */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Title *</label>
                        <Field name="title" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                        <ErrorMessage name="title" component="p" className="text-xs text-rose-600" />
                      </div>
                      
                      {/* 2. Description */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Description *</label>
                        <Field as="textarea" name="description" rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                        <ErrorMessage name="description" component="p" className="text-xs text-rose-600" />
                      </div>
                      
                      {/* 3. Priority, Status, Estimate */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Priority *</label>
                          <Field as="select" name="priority" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                            {(['P0', 'P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                              <option key={p} value={p} disabled={!canEditP0 && p === 'P0'}>
                                {p}
                              </option>
                            ))}
                          </Field>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Status *</label>
                          <Field as="select" name="status" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                            {wfCols.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Field>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">{estLabel}</label>
                          <Field
                            name="estimate"
                            type="number"
                            step={mode === 'hours' ? '0.5' : '1'}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <ErrorMessage name="estimate" component="p" className="text-xs text-rose-600" />
                        </div>
                      </div>

                      {/* 4. Current Assignee */}
                      {assigneeControlsBlock}

                      {/* 5-6. Start date, Due date */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Start date *</label>
                          <Field name="startDate" type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <ErrorMessage name="startDate" component="p" className="text-xs text-rose-600" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Due date *</label>
                          <Field name="dueDate" type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                          <ErrorMessage name="dueDate" component="p" className="text-xs text-rose-600" />
                        </div>
                      </div>

                      {/* 4. Comments */}
                      {commentsBlock}

                      {/* 5. Related work */}
                      {relatedWorkBlock}
                      
                      {/* Dependencies (kept near Related work) */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Dependencies (task UUIDs, comma-separated)</label>
                        <Field
                          name="dependenciesText"
                          as="textarea"
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                        />
                      </div>

                      {/* 6. Resolution (when Done) */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Resolution (when Done)</label>
                        <Field name="resolution" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                      </div>

                      {/* 7. Activity */}
                      {activityBlock}

                      {/* 8. SLA controls */}
                      {slaControlsBlock}

                      {/* 9. ITSM links */}
                      <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">ITSM links</p>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Parent task ID (optional)</label>
                          <Field
                            name="parentTaskId"
                            placeholder="UUID of parent in this project, empty to clear"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                          />
                          <ErrorMessage name="parentTaskId" component="p" className="text-xs text-rose-600" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Major incident task UUID</label>
                          <Field
                            name="metadata.itsmMajorIncidentId"
                            placeholder="Optional UUID"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                          />
                          <ErrorMessage name="metadata.itsmMajorIncidentId" component="p" className="text-xs text-rose-600" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Problem task UUID</label>
                          <Field
                            name="metadata.itsmProblemId"
                            placeholder="Optional UUID"
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                          />
                          <ErrorMessage name="metadata.itsmProblemId" component="p" className="text-xs text-rose-600" />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Change window start</label>
                            <Field name="metadata.changeWindowStart" type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Change window end</label>
                            <Field name="metadata.changeWindowEnd" type="datetime-local" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                      </div>

                      {/* Custom fields (kept after ITSM links) */}
                      {defs.length > 0 && (
                        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                          <p className="text-[10px] font-bold uppercase text-slate-500">Custom fields</p>
                          {defs.map((d) => (
                            <div key={d.key}>
                              <label className="text-xs font-semibold text-slate-600">{d.label}</label>
                              {d.type === 'select' ? (
                                <Field as="select" name={`metadata.${d.key}`} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                                  <option value="">—</option>
                                  {(d.options ?? []).map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </Field>
                              ) : (
                                <Field
                                  name={`metadata.${d.key}`}
                                  type={d.type === 'number' ? 'number' : 'text'}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 10. SLA */}
                      {slaBlock}

                      {/* Other sections */}
                      {csatBlock}

                      {status && <p className="text-xs text-rose-700">{status}</p>}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Save changes
                      </button>
                    </Form>
                  )}
                </Formik>
              ) : (
                <div className="space-y-4">
                  {/* 1-3. Title, Desc, Grid */}
                  <div className="text-sm text-slate-700 space-y-2">
                    <p className="font-semibold">{task.title}</p>
                    <p className="whitespace-pre-wrap text-slate-600">{task.description || '—'}</p>
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-2 text-xs">
                      <div>
                        <span className="block font-semibold text-slate-500">Priority</span>
                        <span>{task.priority}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-500">Status</span>
                        <span>{task.status}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-500">Estimate</span>
                        <span>{task.estimate ?? '—'}</span>
                      </div>
                    </div>
                    {assigneeControlsBlock}
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-2 text-xs">
                      <div>
                        <span className="block font-semibold text-slate-500">Start</span>
                        <span>{task.startDate ? String(task.startDate).slice(0, 10) : '—'}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-500">Due</span>
                        <span>{task.dueDate ? String(task.dueDate).slice(0, 10) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Comments */}
                  {commentsBlock}

                  {/* 5. Related work */}
                  {relatedWorkBlock}
                  
                  {/* Dependencies (Read-only) */}
                  <div className="text-sm text-slate-700">
                    <p className="mt-2 text-xs text-slate-500">
                      Dependencies:{' '}
                      {Number(task.dependencies?.length ?? 0) > 0 ? String(task.dependencies!.length) : '—'}
                    </p>
                  </div>

                  {/* 6. Resolution */}
                  <div className="text-sm text-slate-700">
                    {task.resolution && <p className="mt-1 text-xs text-slate-600">Resolution: {task.resolution}</p>}
                  </div>

                  {/* 7. Activity */}
                  {activityBlock}

                  {/* 8. SLA controls */}
                  {slaControlsBlock}

                  {/* 9. ITSM links (Read-only) */}
                  {(Boolean(task.metadata?.itsmMajorIncidentId) || Boolean(task.metadata?.itsmProblemId) || Boolean(task.metadata?.changeWindowStart)) ? (
                    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-sm text-slate-700">
                      <p className="text-[10px] font-bold uppercase text-slate-500">ITSM links</p>
                      {Boolean(task.metadata?.itsmMajorIncidentId) ? <p className="text-xs">Major Incident: <span className="font-mono">{String(task.metadata!.itsmMajorIncidentId)}</span></p> : null}
                      {Boolean(task.metadata?.itsmProblemId) ? <p className="text-xs">Problem: <span className="font-mono">{String(task.metadata!.itsmProblemId)}</span></p> : null}
                      {Boolean(task.metadata?.changeWindowStart) ? <p className="text-xs">Change Window: {new Date(String(task.metadata!.changeWindowStart)).toLocaleString()} - {task.metadata?.changeWindowEnd ? new Date(String(task.metadata!.changeWindowEnd)).toLocaleString() : '?'}</p> : null}
                    </div>
                  ) : null}

                  {/* 10. SLA */}
                  {slaBlock}

                  {/* Other sections */}
                  {csatBlock}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-md">
        <p className="text-[11px] text-slate-500">
          Esc to close · changes auto-save
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Close
        </button>
      </div>
    </div>
    </div>
  );
}

type TaskCommentRow = {
  id: string;
  body: string;
  mentions?: string[];
  mentionDisplay?: { handle: string; userId: string; displayName: string; email: string }[];
  createdAt: string;
  author: { id: string; email: string | null; firstName: string | null; lastName: string | null } | null;
};

function TaskCsatSection({
  taskId,
  boardId,
  task,
}: {
  taskId: string;
  boardId: string;
  task: TaskRow;
}) {
  const qc = useQueryClient();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const existing = task.metadata?.csat as { score?: number } | undefined;

  const csat = useMutation({
    mutationFn: async () => {
      if (score == null) throw new Error('Pick a score');
      const res = await apiFetch(`/tasks/${taskId}/csat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comment: comment.trim() || null }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'CSAT failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  if (task.status !== 'Done' || existing?.score != null) return null;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <h3 className="text-xs font-bold uppercase text-slate-600">Satisfaction (CSAT)</h3>
      <p className="text-[11px] text-slate-500">How satisfied are you with this resolution? (1 = low, 5 = high)</p>
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
              score === n ? 'bg-indigo-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {csat.isError && <p className="text-xs text-rose-700">{(csat.error as Error).message}</p>}
      <button
        type="button"
        disabled={score == null || csat.isPending}
        onClick={() => csat.mutate()}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {csat.isPending ? 'Saving…' : 'Submit CSAT'}
      </button>
    </div>
  );
}

function TaskCommentsSection({ taskId, boardId }: { taskId: string; boardId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const commentsQ = useQuery({
    queryKey: ['task-comments', taskId],
    enabled: Boolean(taskId),
    queryFn: () => apiJson<{ comments: TaskCommentRow[] }>(`/tasks/${taskId}/comments`),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((b as { error?: string }).error ?? 'Comment failed');
    },
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
    },
  });

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <h3 className="text-xs font-bold uppercase text-slate-600">Comments</h3>
      {commentsQ.isLoading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : commentsQ.isError ? (
        <p className="text-xs text-rose-700">Could not load comments.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
          {(commentsQ.data?.comments ?? []).map((c) => {
            const display: MentionDisplay[] = c.mentionDisplay ?? [];
            const resolvedHandles = new Set(display.map((d) => d.handle.toLowerCase()));
            const unresolved = (c.mentions ?? []).filter((m) => !resolvedHandles.has(m.toLowerCase()));
            return (
            <li key={c.id} className="rounded-lg bg-slate-50 px-2 py-1.5">
              <div className="font-semibold text-slate-800">
                {c.author
                  ? `${c.author.firstName ?? ''} ${c.author.lastName ?? ''}`.trim() || c.author.email || 'User'
                  : 'User'}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{formatCommentBody(c.body, display)}</p>
              {(display.length > 0 || unresolved.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {display.map((m) => (
                    <span
                      key={`d-${m.handle}`}
                      title={m.email}
                      className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-900"
                    >
                      @{m.displayName}
                    </span>
                  ))}
                  {unresolved.map((m) => (
                    <span
                      key={`u-${m}`}
                      title="Not a workspace member"
                      className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                    >
                      @{m}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
            </li>
            );
          })}
        </ul>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Add a comment…"
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {addComment.isError && <p className="text-xs text-rose-700">{(addComment.error as Error).message}</p>}
      <button
        type="button"
        disabled={!draft.trim() || addComment.isPending}
        onClick={() => addComment.mutate()}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {addComment.isPending ? 'Posting…' : 'Post comment'}
      </button>
    </div>
  );
}

function ReassignForm({
  employees,
  onSubmit,
  disabled,
}: {
  employees: EmployeeOption[];
  onSubmit: (toId: string, reason: string) => void;
  disabled: boolean;
}) {
  const [toId, setToId] = useState('');
  const [reason, setReason] = useState('');

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-100 p-2">
      <select
        value={toId}
        onChange={(e) => setToId(e.target.value)}
        className="w-full rounded border border-slate-200 px-2 py-1 text-sm bg-white"
      >
        <option value="">Target user…</option>
        {employees.map((emp) => (
          <option key={emp.userId} value={emp.userId}>
            {emp.firstName} {emp.lastName}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
      />
      <button
        type="button"
        disabled={disabled || !toId || !reason.trim()}
        onClick={() => {
          onSubmit(toId, reason);
          setToId('');
          setReason('');
        }}
        className="text-xs font-semibold text-indigo-700 disabled:opacity-50"
      >
        Reassign
      </button>
    </div>
  );
}
