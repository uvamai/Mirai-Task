import {
  quietHoursBlock,
  getWallClockMinutesInZone,
  isValidIanaTimeZone,
} from './notificationPrefs';

describe('notificationPrefs', () => {
  describe('isValidIanaTimeZone', () => {
    it('accepts common IANA zones', () => {
      expect(isValidIanaTimeZone('UTC')).toBe(true);
      expect(isValidIanaTimeZone('America/New_York')).toBe(true);
      expect(isValidIanaTimeZone('Europe/Paris')).toBe(true);
    });
    it('rejects invalid', () => {
      expect(isValidIanaTimeZone('')).toBe(false);
      expect(isValidIanaTimeZone('Not/A_Zone')).toBe(false);
    });
  });

  describe('getWallClockMinutesInZone', () => {
    it('maps a known instant in UTC vs New York', () => {
      const d = new Date('2026-01-15T05:00:00.000Z');
      const utc = getWallClockMinutesInZone(d, 'UTC');
      const ny = getWallClockMinutesInZone(d, 'America/New_York');
      expect(utc).toBe(5 * 60);
      expect(ny).toBe(0);
    });
  });

  describe('quietHoursBlock', () => {
    const prefsUtc = (start: string, end: string) => ({
      notifications: { quietHoursStart: start, quietHoursEnd: end },
    });

    it('uses UTC when no timezone set', () => {
      const now = new Date('2026-06-01T22:30:00.000Z');
      expect(quietHoursBlock(prefsUtc('22:00', '23:00'), now)).toBe(true);
      expect(quietHoursBlock(prefsUtc('22:00', '23:00'), new Date('2026-06-01T21:30:00.000Z'))).toBe(false);
    });

    it('uses America/New_York for wall clock when configured', () => {
      const prefs = {
        notifications: {
          quietHoursStart: '22:00',
          quietHoursEnd: '23:00',
          quietHoursTimezone: 'America/New_York',
        },
      };
      const during = new Date('2026-06-02T02:30:00.000Z');
      expect(quietHoursBlock(prefs, during)).toBe(true);
      const before = new Date('2026-06-02T01:30:00.000Z');
      expect(quietHoursBlock(prefs, before)).toBe(false);
    });

    it('wraps past midnight window in local TZ', () => {
      const prefs = {
        notifications: {
          quietHoursStart: '22:00',
          quietHoursEnd: '06:00',
          quietHoursTimezone: 'UTC',
        },
      };
      expect(quietHoursBlock(prefs, new Date('2026-06-01T23:00:00.000Z'))).toBe(true);
      expect(quietHoursBlock(prefs, new Date('2026-06-01T12:00:00.000Z'))).toBe(false);
    });
  });
});
