export function dueRemindersEnabled(preferences: Record<string, unknown> | undefined): boolean {
  const n = preferences?.notifications as Record<string, unknown> | undefined;
  if (n && n.dueReminders === false) return false;
  return true;
}

export function mentionsEnabled(preferences: Record<string, unknown> | undefined): boolean {
  const n = preferences?.notifications as Record<string, unknown> | undefined;
  if (n && n.mentions === false) return false;
  return true;
}

export function quietHoursBlock(preferences: Record<string, unknown> | undefined, now: Date): boolean {
  const n = preferences?.notifications as Record<string, unknown> | undefined;
  const start = typeof n?.quietHoursStart === 'string' ? n.quietHoursStart : null;
  const end = typeof n?.quietHoursEnd === 'string' ? n.quietHoursEnd : null;
  if (!start || !end) return false;
  const [sh, sm] = start.split(':').map((x) => Number(x));
  const [eh, em] = end.split(':').map((x) => Number(x));
  if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const s = sh * 60 + (sm || 0);
  const e = eh * 60 + (em || 0);
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}
