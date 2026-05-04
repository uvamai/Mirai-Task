export function advanceNextRun(from: Date, frequency: string, intervalCount: number): Date {
  const n = Math.max(1, Math.min(12, Math.floor(intervalCount) || 1));
  const d = new Date(from.getTime());
  if (frequency === 'daily') {
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }
  if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * n);
    return d;
  }
  if (frequency === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() + n);
    return d;
  }
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** First run instant on/after start date (UTC midnight of DATEONLY string). */
export function initialNextRun(startDateYmd: string): Date {
  const [y, m, day] = startDateYmd.split('-').map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, day || 1, 8, 0, 0, 0));
}

export function fastForwardNextRun(startDateYmd: string, frequency: string, intervalCount: number): Date {
  let next = initialNextRun(startDateYmd);
  const now = Date.now();
  let guard = 0;
  while (next.getTime() <= now && guard < 730) {
    next = advanceNextRun(next, frequency, intervalCount);
    guard += 1;
  }
  return next;
}
