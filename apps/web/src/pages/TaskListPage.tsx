import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiFetch, apiJson } from '../api/client';
import { TaskCardContextMenu } from '../features/tasks/TaskCardContextMenu';
import { isTaskIdParam } from '../features/tasks/taskDeepLinks';
import { TaskDetailPanel } from '../features/tasks/TaskDetailPanel';
import type { TaskRow, CustomFieldDef } from '../features/tasks/types';
import { TagPill } from '../components/TagPill';
import { BoardToolbar } from '../components/board/BoardToolbar';
import { FieldsPanel } from '../components/board/FieldsPanel';
import {
  EMPTY_FILTERS,
  matchesFilters,
  useSavedViews,
  type SavedView,
  type SavedViewFilters,
} from '../hooks/useSavedViews';
import {
  applySavedViewColumnSnapshot,
  LIST_COLUMN_LABELS,
  listGridTemplate,
  prefsDifferFromDefaults,
  useViewColumnPrefs,
  visibleListColumnKeys,
  type ListColumnKey,
} from '../hooks/useViewColumnPrefs';
import { boardShellAppPath } from '../hooks/useBoardShellView';

type TasksPayload = {
  tasks: TaskRow[];
  estimateMode?: string;
  estimateUnitLabel?: string;
  workflowStages?: string[];
  customFieldDefs?: CustomFieldDef[];
};

type StagesPayload = { defaultStages: string[]; customStages: string[] | null };

function dueCell(t: TaskRow) {
  return t.dueDate
    ? typeof t.dueDate === 'string'
      ? t.dueDate.slice(0, 10)
      : String(t.dueDate).slice(0, 10)
    : '—';
}

function ListRowCells({ t, keys }: { t: TaskRow; keys: ListColumnKey[] }) {
  const cells: ReactNode[] = [];
  for (const k of keys) {
    if (k === 'key') {
      cells.push(
        <div key={k} className="font-semibold text-indigo-700">
          {t.key}
        </div>
      );
    } else if (k === 'title') {
      cells.push(
        <div key={k} className="min-w-0">
          <div className="truncate text-slate-900">{t.title}</div>
        </div>
      );
    } else if (k === 'status') {
      cells.push(
        <div key={k} className="text-slate-700">
          {t.status}
        </div>
      );
    } else if (k === 'priority') {
      cells.push(<div key={k}>{t.priority}</div>);
    } else if (k === 'dueDate') {
      cells.push(<div key={k} className="text-slate-600">{dueCell(t)}</div>);
    } else if (k === 'tags') {
      cells.push(
        <div key={k} className="flex flex-wrap gap-1 text-slate-700">
          {(t.tags ?? []).length ? (t.tags ?? []).map((tag) => <TagPill key={tag} tag={tag} />) : '—'}
        </div>
      );
    } else if (k === 'deps') {
      cells.push(
        <div key={k} className="text-slate-600">
          {(t.dependencies?.length ?? 0) > 0 ? t.dependencies!.length : '—'}
        </div>
      );
    }
  }
  return <>{cells}</>;
}

function TableRowCells({ t, keys }: { t: TaskRow; keys: ListColumnKey[] }) {
  const cells: ReactNode[] = [];
  for (const k of keys) {
    if (k === 'key') {
      cells.push(
        <td key={k} className="whitespace-nowrap px-3 py-2 font-semibold text-indigo-700">
          {t.key}
        </td>
      );
    } else if (k === 'title') {
      cells.push(
        <td key={k} className="max-w-xs px-3 py-2 text-slate-900">
          <div className="truncate">{t.title}</div>
        </td>
      );
    } else if (k === 'status') {
      cells.push(
        <td key={k} className="whitespace-nowrap px-3 py-2 text-slate-700">
          {t.status}
        </td>
      );
    } else if (k === 'priority') {
      cells.push(
        <td key={k} className="whitespace-nowrap px-3 py-2">
          {t.priority}
        </td>
      );
    } else if (k === 'dueDate') {
      cells.push(
        <td key={k} className="whitespace-nowrap px-3 py-2 text-slate-600">
          {dueCell(t)}
        </td>
      );
    } else if (k === 'tags') {
      cells.push(
        <td key={k} className="px-3 py-2 text-slate-700">
          <div className="flex flex-wrap gap-1">
            {(t.tags ?? []).length ? (t.tags ?? []).map((tag) => <TagPill key={tag} tag={tag} />) : '—'}
          </div>
        </td>
      );
    } else if (k === 'deps') {
      cells.push(
        <td key={k} className="whitespace-nowrap px-3 py-2 text-slate-600">
          {(t.dependencies?.length ?? 0) > 0 ? t.dependencies!.length : '—'}
        </td>
      );
    }
  }
  return <>{cells}</>;
}

export function TaskListPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();
  const location = useLocation();
  const isTableShell = location.pathname.endsWith('/table');
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
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
  const [toast, setToast] = useState<string | null>(null);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(false);
  const [fieldsEmphasis, setFieldsEmphasis] = useState<'list' | 'board'>('list');
  const savedViews = useSavedViews(boardId);
  const columnPrefs = useViewColumnPrefs(boardId);

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

  const patchTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(b.error ?? 'Update failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks', boardId] }),
    onError: (e: Error) => {
      setToast(e.message);
      setTimeout(() => setToast(null), 4000);
    },
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

  const filtered = useMemo(
    () => sorted.filter((t) => matchesFilters(t, filters)),
    [sorted, filters]
  );

  const listKeys = visibleListColumnKeys(columnPrefs.prefs.list);
  const gridTemplate = listGridTemplate(listKeys);
  const gridWithMenu = useMemo(() => `${gridTemplate} 2.25rem`, [gridTemplate]);
  const diff = useMemo(() => prefsDifferFromDefaults(columnPrefs.prefs), [columnPrefs.prefs]);
  const layoutDirty = diff.list || diff.board;

  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = !isTableShell && filtered.length > 48;
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });

  const role = meQ.data?.membership.role ?? '';
  const canDuplicate = role === 'ADMIN' || role === 'MANAGER';
  const hasFilters = filters.search.length > 0 || filters.priorities.length > 0;

  if (!projectId || !boardId) return <p className="text-slate-600">Missing board</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Link
          to={boardShellAppPath(projectId, boardId)}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          ← Board
        </Link>
      </div>

      <BoardToolbar
        canManageBoard={false}
        isAdmin={false}
        canCreate={false}
        showBoardChrome={false}
        surfaceLabel={isTableShell ? 'Table' : 'List'}
        density="comfortable"
        onDensity={() => undefined}
        onEditColumns={() => undefined}
        onSaveTemplate={() => undefined}
        onNewTask={() => undefined}
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
          applySavedViewColumnSnapshot(boardId, {
            listColumns: view.listColumns,
            boardCardFields: view.boardCardFields,
          });
          columnPrefs.reload();
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
        canSaveView={hasFilters || layoutDirty}
        fieldToggleSurface="list"
        listColumnVisibility={columnPrefs.prefs.list}
        onToggleListColumn={columnPrefs.toggleList}
        onOpenFieldsPanel={() => {
          setFieldsEmphasis('list');
          setFieldsPanelOpen(true);
        }}
      />

      <FieldsPanel
        open={fieldsPanelOpen}
        onClose={() => setFieldsPanelOpen(false)}
        workflowStages={wf}
        list={columnPrefs.prefs.list}
        board={columnPrefs.prefs.board}
        onToggleList={columnPrefs.toggleList}
        onToggleBoard={columnPrefs.toggleBoard}
        onResetDefaults={columnPrefs.resetDefaults}
        emphasis={fieldsEmphasis}
      />

      <TaskDetailPanel
        taskId={selectedTaskId}
        boardId={boardId}
        columns={wf}
        membershipRole={role}
        userId={meQ.data?.user.id}
        estimateMode={estimateMode}
        onClose={closeTask}
      />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{toast}</div>
      )}

      {tasksQ.isLoading || stagesQ.isLoading ? (
        <p className="text-slate-600">Loading…</p>
      ) : useVirtual ? (
        <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/55 shadow-[var(--shadow-neu)] backdrop-blur-md">
          <div
            className="grid gap-0 border-b border-slate-200 bg-slate-50/90 px-3 py-2 text-xs font-bold uppercase text-slate-600"
            style={{ gridTemplateColumns: gridWithMenu }}
          >
            {listKeys.map((k) => (
              <div key={k}>{LIST_COLUMN_LABELS[k]}</div>
            ))}
            <div className="text-center font-normal normal-case" aria-label="Row actions">
              {' '}
            </div>
          </div>
          <div ref={parentRef} className="max-h-[min(70vh,560px)] overflow-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const t = filtered[vi.index];
                return (
                  <div
                    key={t.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vi.start}px)`,
                      display: 'grid',
                      gridTemplateColumns: gridWithMenu,
                    }}
                    className="items-center gap-0 border-b border-slate-100 px-3 py-2 text-sm hover:bg-indigo-50/40"
                    onClick={() => openTask(t.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openTask(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <ListRowCells t={t} keys={listKeys} />
                    <div className="flex justify-end">
                      <TaskCardContextMenu
                        task={t}
                        projectId={projectId}
                        boardId={boardId}
                        shellPathname={location.pathname}
                        canDuplicate={canDuplicate}
                        onOpen={openTask}
                        onDuplicate={(c) => {
                          void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
                          openTask(c.id);
                        }}
                        onToast={(msg) => {
                          setToast(msg);
                          setTimeout(() => setToast(null), 4000);
                        }}
                        workflowColumns={wf}
                        onMoveToStatus={(status) => patchTaskStatus.mutateAsync({ taskId: t.id, status })}
                      />
                    </div>
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
                {listKeys.map((k) => (
                  <th key={k} className="px-3 py-2">
                    {LIST_COLUMN_LABELS[k]}
                  </th>
                ))}
                <th className="w-10 px-1 py-2" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
                  onClick={() => openTask(t.id)}
                >
                  <TableRowCells t={t} keys={listKeys} />
                  <td className="w-10 px-1 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
                    <TaskCardContextMenu
                      task={t}
                      projectId={projectId}
                      boardId={boardId}
                      shellPathname={location.pathname}
                      canDuplicate={canDuplicate}
                      onOpen={openTask}
                      onDuplicate={(c) => {
                        void qc.invalidateQueries({ queryKey: ['tasks', boardId] });
                        openTask(c.id);
                      }}
                      onToast={(msg) => {
                        setToast(msg);
                        setTimeout(() => setToast(null), 4000);
                      }}
                      workflowColumns={wf}
                      onMoveToStatus={(status) => patchTaskStatus.mutateAsync({ taskId: t.id, status })}
                    />
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
