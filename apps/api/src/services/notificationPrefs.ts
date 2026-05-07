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

export function isValidIanaTimeZone(tz: string): boolean {
  const s = tz.trim();
  if (!s) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: s });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock minutes 0–1439 in `timeZone` for instant `now`. */
export function getWallClockMinutesInZone(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hv = parts.find((p) => p.type === 'hour')?.value;
    const mv = parts.find((p) => p.type === 'minute')?.value;
    if (hv === undefined || mv === undefined) return null;
    const h = Number(hv);
    const m = Number(mv);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

/**
 * True when `now` falls inside the user's quiet window.
 * Window times (HH:MM) are interpreted in `notifications.quietHoursTimezone` when set and valid IANA; otherwise UTC (legacy).
 */
export function quietHoursBlock(preferences: Record<string, unknown> | undefined, now: Date): boolean {
  const n = preferences?.notifications as Record<string, unknown> | undefined;
  const start = typeof n?.quietHoursStart === 'string' ? n.quietHoursStart : null;
  const end = typeof n?.quietHoursEnd === 'string' ? n.quietHoursEnd : null;
  if (!start || !end) return false;
  const tzRaw = typeof n?.quietHoursTimezone === 'string' ? n.quietHoursTimezone.trim() : '';
  const timeZone = tzRaw && isValidIanaTimeZone(tzRaw) ? tzRaw : 'UTC';

  const [sh, sm] = start.split(':').map((x) => Number(x));
  const [eh, em] = end.split(':').map((x) => Number(x));
  if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;
  const s = sh * 60 + (sm || 0);
  const e = eh * 60 + (em || 0);
  if (s === e) return false;

  const mins = getWallClockMinutesInZone(now, timeZone);
  if (mins === null) return false;

  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}
