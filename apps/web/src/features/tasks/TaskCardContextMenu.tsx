import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiJson } from '../../api/client';
import type { TaskRow } from './types';
import { relatedTaskAbsolute, relatedTaskHref, taskDeepLinkAbsolute, UUID_RE } from './taskDeepLinks';

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

function formatDueForApi(due: string | null | undefined): string | null {
  if (due == null || due === '') return null;
  if (typeof due !== 'string') return null;
  const s = due.trim();
  if (!s) return null;
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') return `${s.slice(0, 10)}T00:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fixed layer above board columns / list scroll regions (TaskDetailPanel is z-[60]). */
const MENU_Z = 75;

function computeMenuBox(trigger: HTMLButtonElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const gap = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(320, Math.max(220, vw - margin * 2));
  let left = rect.right - width;
  left = Math.max(margin, Math.min(left, vw - width - margin));

  const spaceBelow = vh - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const flip = spaceBelow < 200 && spaceAbove > spaceBelow;

  if (flip) {
    const maxHeight = Math.max(160, Math.min(520, spaceAbove));
    const bottom = vh - rect.top + gap;
    return {
      position: 'fixed',
      zIndex: MENU_Z,
      left,
      width,
      maxHeight,
      bottom,
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    };
  }

  const top = rect.bottom + gap;
  const maxHeight = Math.max(160, Math.min(520, vh - top - margin));
  return {
    position: 'fixed',
    zIndex: MENU_Z,
    top,
    left,
    width,
    maxHeight,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  };
}

type RelatedRow = { id: string; key: string; title: string; status: string; boardId?: string };

type TaskCardContextMenuProps = {
  task: TaskRow;
  projectId: string;
  boardId: string;
  /** Current location pathname (board or list shell). */
  shellPathname: string;
  canDuplicate: boolean;
  onOpen: (taskId: string) => void;
  onDuplicate?: (created: { id: string; key: string }) => void;
  onToast?: (message: string) => void;
  /** PM4 Wave B: kanban workflow columns for “Move to”. */
  workflowColumns?: string[];
  onMoveToStatus?: (status: string) => Promise<void>;
};

export function TaskCardContextMenu({
  task,
  projectId,
  boardId,
  shellPathname,
  canDuplicate,
  onOpen,
  onDuplicate,
  onToast,
  workflowColumns,
  onMoveToStatus,
}: TaskCardContextMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dupPending, setDupPending] = useState(false);
  const [movePending, setMovePending] = useState(false);
  const [menuBox, setMenuBox] = useState<CSSProperties | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const relatedQ = useQuery({
    queryKey: ['task-related-menu', task.id],
    enabled: open && Boolean(task.id),
    queryFn: () => apiJson<{ related: RelatedRow[] }>(`/tasks/${task.id}/related`),
  });

  const toast = useCallback(
    (msg: string) => {
      if (onToast) onToast(msg);
      else window.alert(msg);
    },
    [onToast]
  );

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    const el = btnRef.current;
    if (!el) return;
    const sync = () => {
      if (!btnRef.current) return;
      setMenuBox(computeMenuBox(btnRef.current));
    };
    sync();
    window.addEventListener('resize', sync);
    document.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      document.removeEventListener('scroll', sync, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const runCopy = async (label: string, text: string) => {
    try {
      await copyText(text);
      toast(`${label} copied`);
    } catch {
      toast('Could not copy to clipboard');
    }
    setOpen(false);
  };

  const moveTo = async (status: string) => {
    if (!onMoveToStatus || movePending || status === task.status) return;
    setMovePending(true);
    try {
      await onMoveToStatus(status);
      toast(`Moved to ${status}`);
      setOpen(false);
    } catch {
      /* BoardPage / TaskListPage mutation onError may surface the message */
    } finally {
      setMovePending(false);
    }
  };

  const openRelated = useCallback(
    (r: RelatedRow, opts?: { newTab?: boolean }) => {
      const otherBoardId = r.boardId ?? boardId;
      if (otherBoardId === boardId) {
        if (opts?.newTab) {
          window.open(taskDeepLinkAbsolute(shellPathname, r.id), '_blank', 'noopener,noreferrer');
        } else {
          onOpen(r.id);
        }
      } else {
        const href = relatedTaskHref(projectId, otherBoardId, r.id);
        if (opts?.newTab) {
          window.open(relatedTaskAbsolute(projectId, otherBoardId, r.id), '_blank', 'noopener,noreferrer');
        } else {
          navigate(href);
        }
      }
      setOpen(false);
    },
    [boardId, navigate, onOpen, projectId, shellPathname]
  );

  const duplicate = async () => {
    if (!canDuplicate || dupPending) return;
    setDupPending(true);
    try {
      const titleBase = `Copy of ${task.title}`.trim();
      const title = titleBase.length > 512 ? titleBase.slice(0, 512) : titleBase;
      const body = {
        title,
        description: task.description ?? '',
        priority: task.priority,
        status: task.status,
        tags: [...(task.tags ?? [])],
        estimate: task.estimate ?? null,
        dueDate: formatDueForApi(task.dueDate ?? undefined),
        metadata: {},
        parentTaskId: null as string | null,
      };
      const res = await apiFetch(`/boards/${boardId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = (await res.json().catch(() => ({}))) as { id?: string; key?: string; error?: string };
      if (!res.ok) throw new Error(b.error ?? 'Duplicate failed');
      if (!b.id || !b.key) throw new Error('Duplicate failed');
      onDuplicate?.({ id: b.id, key: b.key });
      toast(`Duplicated as ${b.key}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setDupPending(false);
      setOpen(false);
    }
  };

  const menuContent = (
    <div
      ref={menuRef}
      role="menu"
      style={menuBox ?? undefined}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="rounded-xl border border-slate-200 bg-white py-1 shadow-2xl ring-1 ring-slate-900/5"
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => {
          onOpen(task.id);
          setOpen(false);
        }}
      >
        Open
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => void runCopy('Link', taskDeepLinkAbsolute(shellPathname, task.id))}
      >
        Copy link
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => void runCopy('Task key', task.key)}
      >
        Copy task key
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => void runCopy('Task ID', task.id)}
      >
        Copy task ID
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => {
          window.open(taskDeepLinkAbsolute(shellPathname, task.id), '_blank', 'noopener,noreferrer');
          setOpen(false);
        }}
      >
        Open in new tab
      </button>
      {(task.dependencies?.length ?? 0) > 0 && (
        <>
          <div className="my-1 h-px bg-slate-100" />
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Blocking dependencies
          </div>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
            onClick={() =>
              void runCopy(
                'Dependency task IDs',
                (task.dependencies ?? []).filter((id) => UUID_RE.test(id)).join(', ')
              )
            }
          >
            Copy dependency IDs ({task.dependencies!.length})
          </button>
        </>
      )}
      <div className="my-1 h-px bg-slate-100" />
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Related tasks</div>
      {relatedQ.isLoading && <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>}
      {relatedQ.isError && (
        <div className="px-3 py-2 text-xs text-rose-600">Could not load related tasks.</div>
      )}
      {!relatedQ.isLoading && !relatedQ.isError && (relatedQ.data?.related ?? []).length === 0 && (
        <div className="px-3 py-2 text-xs text-slate-500">None linked (TaskRelation).</div>
      )}
      {(relatedQ.data?.related ?? []).map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-0 border-b border-slate-50 last:border-b-0 hover:bg-slate-50"
        >
          <button
            type="button"
            role="menuitem"
            className="min-w-0 flex-1 px-3 py-1.5 text-left text-sm text-slate-800"
            title={r.title}
            onClick={() => openRelated(r)}
          >
            <span className="font-semibold text-indigo-700">{r.key}</span>
            <span className="text-slate-500"> · {r.status}</span>
            <div className="truncate text-[11px] text-slate-600">{r.title}</div>
          </button>
          <button
            type="button"
            className="shrink-0 px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-700"
            title="Open in new tab"
            aria-label={`Open ${r.key} in new tab`}
            onClick={() => openRelated(r, { newTab: true })}
          >
            ↗
          </button>
        </div>
      ))}
      {workflowColumns && workflowColumns.length > 0 && onMoveToStatus && (
        <>
          <div className="my-1 h-px bg-slate-100" />
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Move to</div>
          {workflowColumns.map((col) => (
            <button
              key={col}
              type="button"
              role="menuitem"
              disabled={movePending || col === task.status}
              className="block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void moveTo(col)}
            >
              {col === task.status ? `${col} (current)` : col}
            </button>
          ))}
        </>
      )}
      {canDuplicate && (
        <>
          <div className="my-1 h-px bg-slate-100" />
          <button
            type="button"
            role="menuitem"
            disabled={dupPending}
            className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => void duplicate()}
          >
            {dupPending ? 'Duplicating…' : 'Duplicate'}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="relative shrink-0 self-start" onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        data-testid="task-card-menu-trigger"
        className="rounded-lg px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Task actions for ${task.key}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        ⋮
      </button>
      {open && menuBox && typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </div>
  );
}
