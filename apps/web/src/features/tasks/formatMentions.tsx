import type { ReactNode } from 'react';

/** Resolved mention record returned by the API (`/tasks/:id/comments`). */
export type MentionDisplay = {
  handle: string;
  userId: string;
  displayName: string;
  email: string;
};

const MENTION_RE = /@([a-zA-Z0-9._+-]+)/g;

/**
 * P10 — Split a comment body into plain text + mention tokens. Known handles
 * (resolved by the API) are rendered as styled chips showing the user's display
 * name; unknown handles fall back to the raw `@handle` text so we never lose
 * information when membership changes.
 */
export function formatCommentBody(body: string, mentions: MentionDisplay[]): ReactNode[] {
  const map = new Map<string, MentionDisplay>();
  for (const m of mentions) map.set(m.handle.toLowerCase(), m);

  const out: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(body.slice(last, start));
    const handle = match[1] ?? '';
    const resolved = map.get(handle.toLowerCase());
    if (resolved) {
      out.push(
        <span
          key={`m-${idx++}`}
          title={`${resolved.displayName} · ${resolved.email}`}
          className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-900 ring-1 ring-indigo-200"
        >
          @{resolved.displayName}
        </span>
      );
    } else {
      out.push(
        <span key={`m-${idx++}`} className="text-indigo-700">
          @{handle}
        </span>
      );
    }
    last = start + match[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}
