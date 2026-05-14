import {
  _resetRateLimits,
  assertTenantRateLimit,
  TenantRateLimitError,
  tryTenantRateLimit,
  tryUserRateLimit,
} from './planLimits';

describe('planLimits — generic tenant/user rate limiter (P12)', () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  describe('assertTenantRateLimit', () => {
    it('allows up to cap, throws TenantRateLimitError on the (cap+1)th call', () => {
      const tenantId = 't-1';
      const key = 'test_a';
      const cap = 3;
      for (let i = 0; i < cap; i++) {
        expect(() => assertTenantRateLimit({ tenantId, key, cap })).not.toThrow();
      }
      let thrown: unknown;
      try {
        assertTenantRateLimit({ tenantId, key, cap });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(TenantRateLimitError);
      const err = thrown as TenantRateLimitError;
      expect(err.code).toBe('LIMIT_RATE_TEST_A');
      expect(err.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('does not bleed across tenants', () => {
      const cap = 2;
      assertTenantRateLimit({ tenantId: 't-a', key: 'shared', cap });
      assertTenantRateLimit({ tenantId: 't-a', key: 'shared', cap });
      expect(() => assertTenantRateLimit({ tenantId: 't-a', key: 'shared', cap })).toThrow(
        TenantRateLimitError
      );
      expect(() => assertTenantRateLimit({ tenantId: 't-b', key: 'shared', cap })).not.toThrow();
    });

    it('does not bleed across keys for the same tenant', () => {
      const cap = 1;
      const tenantId = 't-multi';
      assertTenantRateLimit({ tenantId, key: 'k1', cap });
      expect(() => assertTenantRateLimit({ tenantId, key: 'k1', cap })).toThrow(TenantRateLimitError);
      expect(() => assertTenantRateLimit({ tenantId, key: 'k2', cap })).not.toThrow();
    });

    it('resets the bucket on _resetRateLimits()', () => {
      const tenantId = 't-reset';
      const key = 'flood';
      assertTenantRateLimit({ tenantId, key, cap: 1 });
      expect(() => assertTenantRateLimit({ tenantId, key, cap: 1 })).toThrow(TenantRateLimitError);
      _resetRateLimits();
      expect(() => assertTenantRateLimit({ tenantId, key, cap: 1 })).not.toThrow();
    });

    it('window is a lookback (minute lookback excludes events older than 60s)', () => {
      const tenantId = 't-win';
      const key = 'fanout';
      const realNow = Date.now;
      const base = realNow();
      let nowOverride = base;
      jest.spyOn(Date, 'now').mockImplementation(() => nowOverride);
      try {
        assertTenantRateLimit({ tenantId, key, cap: 1, window: 'minute' });
        nowOverride = base + 61_000;
        expect(() =>
          assertTenantRateLimit({ tenantId, key, cap: 1, window: 'minute' })
        ).not.toThrow();
        nowOverride = base + 61_500;
        expect(() =>
          assertTenantRateLimit({ tenantId, key, cap: 1, window: 'minute' })
        ).toThrow(TenantRateLimitError);
      } finally {
        (Date.now as jest.Mock).mockRestore?.();
      }
    });
  });

  describe('tryTenantRateLimit (soft)', () => {
    it('returns true under cap, false at/over cap, never throws', () => {
      const tenantId = 't-soft';
      const key = 'webhook_fanout';
      const cap = 2;
      expect(tryTenantRateLimit({ tenantId, key, cap })).toBe(true);
      expect(tryTenantRateLimit({ tenantId, key, cap })).toBe(true);
      expect(tryTenantRateLimit({ tenantId, key, cap })).toBe(false);
      expect(tryTenantRateLimit({ tenantId, key, cap })).toBe(false);
    });
  });

  describe('tryUserRateLimit (soft, per-user)', () => {
    it('isolates per-user buckets', () => {
      const cap = 1;
      const key = 'notifications_create';
      expect(tryUserRateLimit({ userId: 'u-1', key, cap })).toBe(true);
      expect(tryUserRateLimit({ userId: 'u-1', key, cap })).toBe(false);
      expect(tryUserRateLimit({ userId: 'u-2', key, cap })).toBe(true);
    });
  });
});
