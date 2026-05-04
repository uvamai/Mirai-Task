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
