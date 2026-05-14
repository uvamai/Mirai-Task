import { boardShellAppPath } from '../../hooks/useBoardShellView';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTaskIdParam(value: string | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** Path + query only, e.g. `/app/projects/…/boards/…?task=uuid` */
export function taskDeepLinkPath(shellPathname: string, taskId: string): string {
  const u = new URL(shellPathname, 'http://local.invalid');
  u.searchParams.set('task', taskId);
  return `${u.pathname}${u.search}`;
}

export function taskDeepLinkAbsolute(shellPathname: string, taskId: string): string {
  if (typeof window === 'undefined') return taskDeepLinkPath(shellPathname, taskId);
  return `${window.location.origin}${taskDeepLinkPath(shellPathname, taskId)}`;
}

/** Deep link to a task on another board using the user’s preferred shell for that board. */
export function relatedTaskHref(projectId: string, otherBoardId: string, taskId: string): string {
  const base = boardShellAppPath(projectId, otherBoardId);
  const u = new URL(base, 'http://local.invalid');
  u.searchParams.set('task', taskId);
  return `${u.pathname}${u.search}`;
}

export function relatedTaskAbsolute(projectId: string, otherBoardId: string, taskId: string): string {
  if (typeof window === 'undefined') return relatedTaskHref(projectId, otherBoardId, taskId);
  return `${window.location.origin}${relatedTaskHref(projectId, otherBoardId, taskId)}`;
}

export { UUID_RE };
