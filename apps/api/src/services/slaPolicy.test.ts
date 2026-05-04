import {
  addSlaSpanFromStart,
  computeSlaDeadlineFromPolicy,
  DEFAULT_SLA_DAYS,
  resolveSlaPolicy,
} from './slaPolicy';

describe('slaPolicy', () => {
  it('defaults match P0=1 .. P4=7 calendar days', () => {
    const pol = resolveSlaPolicy({});
    expect(pol.daysByPriority.P0).toBe(DEFAULT_SLA_DAYS.P0);
    expect(pol.daysByPriority.P4).toBe(DEFAULT_SLA_DAYS.P4);
    expect(DEFAULT_SLA_DAYS).toMatchObject({ P0: 1, P1: 2, P2: 3, P3: 5, P4: 7 });
  });

  it('merges project.settings.slaDaysByPriority overrides', () => {
    const pol = resolveSlaPolicy({
      slaDaysByPriority: { P3: 9 },
    });
    expect(pol.daysByPriority.P3).toBe(9);
    expect(pol.daysByPriority.P0).toBe(DEFAULT_SLA_DAYS.P0);
  });

  it('computeSlaDeadlineFromPolicy uses calendar days when business days off', () => {
    const pol = resolveSlaPolicy({});
    const started = new Date('2026-05-04T12:00:00.000Z');
    const d = computeSlaDeadlineFromPolicy(started, 'P1', pol, { slaUseBusinessDays: false });
    expect(d.getTime()).toBe(started.getTime() + 2 * 86400_000);
  });

  it('addSlaSpanFromStart with business days advances past the start instant', () => {
    const started = new Date('2026-05-04T12:00:00.000Z');
    const d = addSlaSpanFromStart(started, 1, { slaUseBusinessDays: true });
    expect(d.getTime()).toBeGreaterThan(started.getTime());
  });
});
