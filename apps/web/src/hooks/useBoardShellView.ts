/**
 * PM2 — Per-board "shell" view preference (List / Board / Calendar entry path).
 * Persisted locally under `mirai.boardShellViewByBoardId` (JSON map boardId → mode).
 * Used when switching boards, opening from Cmd/Ctrl+K, and project index redirect;
 * explicit NavLink clicks still set the URL and sync preference via ProjectLayout.
 */
export type BoardShellView = 'board' | 'list' | 'calendar';

export function parseBoardIdFromProjectPath(projectId: string, pathname: string): string | undefined {
  const esc = projectId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = pathname.match(new RegExp(`^/app/projects/${esc}/boards/([^/]+)`));
  return m?.[1];
}

const LS_KEY = 'mirai.boardShellViewByBoardId';

function loadMap(): Record<string, BoardShellView> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, BoardShellView> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'board' || v === 'list' || v === 'calendar') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function storeMap(map: Record<string, BoardShellView>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function getBoardShellView(boardId: string): BoardShellView {
  const m = loadMap();
  return m[boardId] ?? 'board';
}

export function setBoardShellView(boardId: string, view: BoardShellView): void {
  const m = loadMap();
  m[boardId] = view;
  storeMap(m);
}

/** Absolute app path for opening this board using the user's preferred shell view. */
export function boardShellAppPath(projectId: string, boardId: string): string {
  const base = `/app/projects/${projectId}/boards/${boardId}`;
  const v = getBoardShellView(boardId);
  if (v === 'list') return `${base}/list`;
  if (v === 'calendar') return `${base}/calendar`;
  return base;
}

/**
 * Route segment relative to `projects/:projectId` (for `<Navigate to="…" />` under ProjectLayout).
 */
export function boardShellRelativePath(boardId: string): string {
  const v = getBoardShellView(boardId);
  if (v === 'list') return `boards/${boardId}/list`;
  if (v === 'calendar') return `boards/${boardId}/calendar`;
  return `boards/${boardId}`;
}

export function shellViewFromPathname(pathname: string, boardId: string): BoardShellView | null {
  if (pathname.endsWith(`/boards/${boardId}/list`)) return 'list';
  if (pathname.endsWith(`/boards/${boardId}/calendar`)) return 'calendar';
  if (pathname.endsWith(`/boards/${boardId}`)) return 'board';
  return null;
}
