import { TenantMembership, User } from '../models';

/** Map email-local-part (lowercase) → user id for users in this tenant. */
export async function resolveMentionHandlesToUserIds(
  tenantId: string,
  handles: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (handles.length === 0) return out;
  const wanted = new Set(handles.map((h) => h.toLowerCase()));
  const users = await User.findAll({
    attributes: ['id', 'email'],
    include: [
      {
        model: TenantMembership,
        required: true,
        where: { tenantId },
        attributes: [],
      },
    ],
  });
  for (const u of users) {
    const local = u.email.split('@')[0]?.toLowerCase() ?? '';
    if (wanted.has(local) && !out.has(local)) out.set(local, u.id);
  }
  return out;
}

export type ResolvedMention = {
  /** Lowercased email-local-part that was extracted from the body. */
  handle: string;
  userId: string;
  /** Best-effort display name; falls back to email if no first/last set. */
  displayName: string;
  email: string;
};

/**
 * P10 — Batch resolve mention handles to full display records for UI rendering.
 * A single tenant-scoped query is issued; callers should pre-aggregate handles
 * across multiple comments to avoid N+1.
 */
export async function resolveMentionDisplay(
  tenantId: string,
  handles: string[]
): Promise<Map<string, ResolvedMention>> {
  const out = new Map<string, ResolvedMention>();
  if (handles.length === 0) return out;
  const wanted = new Set(handles.map((h) => h.toLowerCase()));
  const users = await User.findAll({
    attributes: ['id', 'email', 'firstName', 'lastName'],
    include: [
      {
        model: TenantMembership,
        required: true,
        where: { tenantId },
        attributes: [],
      },
    ],
  });
  for (const u of users) {
    const local = u.email.split('@')[0]?.toLowerCase() ?? '';
    if (!wanted.has(local) || out.has(local)) continue;
    const composed = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    out.set(local, {
      handle: local,
      userId: u.id,
      displayName: composed || u.email,
      email: u.email,
    });
  }
  return out;
}
