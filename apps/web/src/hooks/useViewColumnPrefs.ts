import { useCallback, useEffect, useMemo, useState } from 'react';

/** List table columns (PM2 per-view JSON). */
export const LIST_COLUMN_KEYS = ['key', 'title', 'status', 'priority', 'dueDate', 'tags', 'deps'] as const;
export type ListColumnKey = (typeof LIST_COLUMN_KEYS)[number];

/** Kanban card chrome (PM2). */
export const BOARD_CARD_FIELD_KEYS = ['key', 'priority', 'estimate', 'tags', 'assignee', 'sla', 'deps', 'dueDate'] as const;
export type BoardCardFieldKey = (typeof BOARD_CARD_FIELD_KEYS)[number];

export type ViewColumnPrefsV1 = {
  version: 1;
  list: Record<ListColumnKey, boolean>;
  board: Record<BoardCardFieldKey, boolean>;
};

const LS_KEY = 'mirai.viewColumnPrefs.v1';

function allTrueList(): Record<ListColumnKey, boolean> {
  return Object.fromEntries(LIST_COLUMN_KEYS.map((k) => [k, true])) as Record<ListColumnKey, boolean>;
}

function allTrueBoard(): Record<BoardCardFieldKey, boolean> {
  return Object.fromEntries(BOARD_CARD_FIELD_KEYS.map((k) => [k, true])) as Record<BoardCardFieldKey, boolean>;
}

export const DEFAULT_VIEW_COLUMN_PREFS: ViewColumnPrefsV1 = {
  version: 1,
  list: allTrueList(),
  board: allTrueBoard(),
};

/** Fresh default prefs (new object identity) for resets. */
export function createDefaultViewColumnPrefs(): ViewColumnPrefsV1 {
  return { version: 1, list: allTrueList(), board: allTrueBoard() };
}

function loadRoot(): Record<string, ViewColumnPrefsV1> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, ViewColumnPrefsV1> = {};
    for (const [bid, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Partial<ViewColumnPrefsV1>;
      const list = { ...allTrueList(), ...(typeof o.list === 'object' && o.list ? o.list : {}) };
      const board = { ...allTrueBoard(), ...(typeof o.board === 'object' && o.board ? o.board : {}) };
      for (const k of LIST_COLUMN_KEYS) if (typeof list[k] !== 'boolean') list[k] = true;
      for (const k of BOARD_CARD_FIELD_KEYS) if (typeof board[k] !== 'boolean') board[k] = true;
      out[bid] = { version: 1, list, board };
    }
    return out;
  } catch {
    return {};
  }
}

function writeRoot(root: Record<string, ViewColumnPrefsV1>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(root));
  } catch {
    /* ignore */
  }
}

export function getViewColumnPrefs(boardId: string): ViewColumnPrefsV1 {
  const root = loadRoot();
  return root[boardId] ?? { ...DEFAULT_VIEW_COLUMN_PREFS, list: allTrueList(), board: allTrueBoard() };
}

export function setViewColumnPrefs(boardId: string, next: ViewColumnPrefsV1): void {
  const root = loadRoot();
  root[boardId] = next;
  writeRoot(root);
}

export function patchViewColumnPrefs(
  boardId: string,
  patch: Partial<{ list: Partial<Record<ListColumnKey, boolean>>; board: Partial<Record<BoardCardFieldKey, boolean>> }>
): ViewColumnPrefsV1 {
  const cur = getViewColumnPrefs(boardId);
  const merged: ViewColumnPrefsV1 = {
    version: 1,
    list: { ...cur.list, ...patch.list },
    board: { ...cur.board, ...patch.board },
  };
  setViewColumnPrefs(boardId, merged);
  return merged;
}

/** When applying a saved M10 view, merge optional column snapshots into local prefs. */
export const LIST_COLUMN_LABELS: Record<ListColumnKey, string> = {
  key: 'Key',
  title: 'Title',
  status: 'Status',
  priority: 'Prio',
  dueDate: 'Due',
  tags: 'Tags',
  deps: 'Deps',
};

export const BOARD_CARD_LABELS: Record<BoardCardFieldKey, string> = {
  key: 'Key',
  priority: 'Priority',
  estimate: 'Estimate',
  tags: 'Tags',
  assignee: 'Assignee',
  sla: 'SLA',
  deps: 'Deps',
  dueDate: 'Due',
};

export function visibleListColumnKeys(list: Record<ListColumnKey, boolean>): ListColumnKey[] {
  return LIST_COLUMN_KEYS.filter((k) => list[k]);
}

export function listGridTemplate(keys: ListColumnKey[]): string {
  const track: Record<ListColumnKey, string> = {
    key: 'minmax(4.5rem,7rem)',
    title: 'minmax(8rem,1fr)',
    status: 'minmax(4rem,6rem)',
    priority: 'minmax(3rem,4rem)',
    dueDate: 'minmax(4rem,5rem)',
    tags: 'minmax(4rem,6rem)',
    deps: 'minmax(2.5rem,3rem)',
  };
  return keys.map((k) => track[k]).join(' ');
}

export function prefsDifferFromDefaults(p: ViewColumnPrefsV1): { list: boolean; board: boolean } {
  return {
    list: LIST_COLUMN_KEYS.some((k) => !p.list[k]),
    board: BOARD_CARD_FIELD_KEYS.some((k) => !p.board[k]),
  };
}

/** When applying a saved M10 view, merge optional column snapshots into local prefs. */
export function applySavedViewColumnSnapshot(
  boardId: string,
  snapshot: {
    listColumns?: Partial<Record<ListColumnKey, boolean>>;
    boardCardFields?: Partial<Record<BoardCardFieldKey, boolean>>;
  }
): void {
  if (!snapshot.listColumns && !snapshot.boardCardFields) return;
  patchViewColumnPrefs(boardId, {
    list: snapshot.listColumns ?? {},
    board: snapshot.boardCardFields ?? {},
  });
}

export function useViewColumnPrefs(boardId: string | undefined): {
  prefs: ViewColumnPrefsV1;
  setPrefs: (next: ViewColumnPrefsV1) => void;
  reload: () => void;
  resetDefaults: () => void;
  toggleList: (k: ListColumnKey) => void;
  toggleBoard: (k: BoardCardFieldKey) => void;
} {
  const [prefs, setPrefsState] = useState<ViewColumnPrefsV1>(() =>
    boardId ? getViewColumnPrefs(boardId) : DEFAULT_VIEW_COLUMN_PREFS
  );

  useEffect(() => {
    if (!boardId) {
      setPrefsState(DEFAULT_VIEW_COLUMN_PREFS);
      return;
    }
    setPrefsState(getViewColumnPrefs(boardId));
  }, [boardId]);

  const reload = useCallback(() => {
    if (!boardId) {
      setPrefsState(DEFAULT_VIEW_COLUMN_PREFS);
      return;
    }
    setPrefsState(getViewColumnPrefs(boardId));
  }, [boardId]);

  const setPrefs = useCallback(
    (next: ViewColumnPrefsV1) => {
      if (!boardId) return;
      setViewColumnPrefs(boardId, next);
      setPrefsState(next);
    },
    [boardId]
  );

  const toggleList = useCallback((k: ListColumnKey) => {
    if (!boardId) return;
    const cur = getViewColumnPrefs(boardId);
    const nextList = { ...cur.list, [k]: !cur.list[k] };
    if (LIST_COLUMN_KEYS.filter((c) => nextList[c]).length < 1) return;
    const next: ViewColumnPrefsV1 = { ...cur, list: nextList };
    setViewColumnPrefs(boardId, next);
    setPrefsState(next);
  }, [boardId]);

  const toggleBoard = useCallback((k: BoardCardFieldKey) => {
    if (!boardId) return;
    const cur = getViewColumnPrefs(boardId);
    const nextBoard = { ...cur.board, [k]: !cur.board[k] };
    if (BOARD_CARD_FIELD_KEYS.filter((c) => nextBoard[c]).length < 1) return;
    const next: ViewColumnPrefsV1 = { ...cur, board: nextBoard };
    setViewColumnPrefs(boardId, next);
    setPrefsState(next);
  }, [boardId]);

  const resetDefaults = useCallback(() => {
    if (!boardId) return;
    const next = createDefaultViewColumnPrefs();
    setViewColumnPrefs(boardId, next);
    setPrefsState(next);
  }, [boardId]);

  return useMemo(
    () => ({ prefs, setPrefs, reload, resetDefaults, toggleList, toggleBoard }),
    [prefs, setPrefs, reload, resetDefaults, toggleList, toggleBoard]
  );
}
