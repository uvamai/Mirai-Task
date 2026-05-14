import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardCardFieldKey, ListColumnKey } from './useViewColumnPrefs';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export const PRIORITY_LEVELS: readonly TaskPriority[] = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;

/**
 * Per-board view persisted to `localStorage` under `mirai.savedViews:<boardId>`. v1 saves the
 * **filters** only — density is a user-level preference and stays in its existing key
 * (`mirai_board_density`). No backend / no sync (M10 ships as a local-only convenience).
 *
 * v2 (PM2): optional **listColumns** / **boardCardFields** snapshots bound when saving/applying
 * named views together with filters.
 */
export type SavedViewFilters = {
  search: string;
  priorities: TaskPriority[];
};

export type SavedView = {
  id: string;
  name: string;
  filters: SavedViewFilters;
  /** ISO timestamp of last save; used to keep the dropdown ordered by recency. */
  savedAt: string;
  /** Optional list column visibility snapshot (Task list view). */
  listColumns?: Partial<Record<ListColumnKey, boolean>>;
  /** Optional kanban card field visibility snapshot. */
  boardCardFields?: Partial<Record<BoardCardFieldKey, boolean>>;
};

export const EMPTY_FILTERS: SavedViewFilters = { search: '', priorities: [] };

const storageKeyFor = (boardId: string): string => `mirai.savedViews:${boardId}`;

function safeLoad(boardId: string): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKeyFor(boardId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is SavedView => Boolean(v) && typeof v === 'object' && typeof (v as SavedView).id === 'string')
      .map((v) => {
        const sv = v as SavedView;
        const out: SavedView = {
          id: sv.id,
          name: typeof sv.name === 'string' ? sv.name : 'Untitled',
          filters:
            sv.filters && typeof sv.filters === 'object'
              ? {
                  search: typeof sv.filters.search === 'string' ? sv.filters.search : '',
                  priorities: Array.isArray(sv.filters.priorities)
                    ? sv.filters.priorities.filter((p): p is TaskPriority =>
                        ['P0', 'P1', 'P2', 'P3', 'P4'].includes(String(p))
                      )
                    : [],
                }
              : EMPTY_FILTERS,
          savedAt: typeof sv.savedAt === 'string' ? sv.savedAt : new Date().toISOString(),
        };
        if (sv.listColumns && typeof sv.listColumns === 'object') out.listColumns = { ...sv.listColumns };
        if (sv.boardCardFields && typeof sv.boardCardFields === 'object') out.boardCardFields = { ...sv.boardCardFields };
        return out;
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}

function safeStore(boardId: string, views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKeyFor(boardId), JSON.stringify(views));
  } catch {
    /* quota or private mode — silently ignore, v1 is local-only convenience */
  }
}

export function useSavedViews(boardId: string | undefined): {
  views: SavedView[];
  saveView: (
    name: string,
    filters: SavedViewFilters,
    snapshot?: { listColumns?: Partial<Record<ListColumnKey, boolean>>; boardCardFields?: Partial<Record<BoardCardFieldKey, boolean>> }
  ) => SavedView;
  deleteView: (id: string) => void;
  renameView: (id: string, name: string) => void;
} {
  const [views, setViews] = useState<SavedView[]>(() => (boardId ? safeLoad(boardId) : []));

  useEffect(() => {
    if (!boardId) return;
    setViews(safeLoad(boardId));
  }, [boardId]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      if (boardId) safeStore(boardId, next);
    },
    [boardId]
  );

  const saveView = useCallback(
    (
      name: string,
      filters: SavedViewFilters,
      snapshot?: {
        listColumns?: Partial<Record<ListColumnKey, boolean>>;
        boardCardFields?: Partial<Record<BoardCardFieldKey, boolean>>;
      }
    ) => {
      const cleanName = name.trim().slice(0, 64) || 'Untitled view';
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const next: SavedView = {
        id,
        name: cleanName,
        filters: { search: filters.search.trim().slice(0, 200), priorities: [...filters.priorities] },
        savedAt: new Date().toISOString(),
      };
      if (snapshot?.listColumns && Object.keys(snapshot.listColumns).length > 0) {
        next.listColumns = { ...snapshot.listColumns };
      }
      if (snapshot?.boardCardFields && Object.keys(snapshot.boardCardFields).length > 0) {
        next.boardCardFields = { ...snapshot.boardCardFields };
      }
      const replaced = views.filter((v) => v.name.toLowerCase() !== cleanName.toLowerCase());
      persist([next, ...replaced].slice(0, 50));
      return next;
    },
    [persist, views]
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [persist, views]
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      const cleanName = name.trim().slice(0, 64) || 'Untitled view';
      persist(views.map((v) => (v.id === id ? { ...v, name: cleanName } : v)));
    },
    [persist, views]
  );

  return useMemo(
    () => ({ views, saveView, deleteView, renameView }),
    [views, saveView, deleteView, renameView]
  );
}

/**
 * Predicate used by BoardPage to filter the task list before grouping it into columns.
 */
export function matchesFilters(
  task: { title: string; key?: string | null; priority?: string | null },
  filters: SavedViewFilters
): boolean {
  if (filters.priorities.length > 0 && (!task.priority || !filters.priorities.includes(task.priority as TaskPriority))) {
    return false;
  }
  const s = filters.search.trim().toLowerCase();
  if (s) {
    const hay = `${task.title ?? ''} ${task.key ?? ''}`.toLowerCase();
    if (!hay.includes(s)) return false;
  }
  return true;
}
