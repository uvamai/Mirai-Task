import { Op } from 'sequelize';
import {
  Board,
  EmployeeProfile,
  Project,
  SubscriptionPlan,
  TenantSubscription,
  TenantUsage,
} from '../models';

export class PlanLimitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PlanLimitError';
    this.code = code;
    Object.setPrototypeOf(this, PlanLimitError.prototype);
  }
}

export async function getActivePlanForTenant(tenantId: string): Promise<{
  plan: SubscriptionPlan;
  subscription: TenantSubscription;
} | null> {
  const subscription = await TenantSubscription.findOne({
    where: { tenantId },
    order: [['createdAt', 'DESC']],
  });
  if (!subscription) return null;
  if (!['active', 'trialing'].includes(subscription.status)) {
    return null;
  }
  const plan = await SubscriptionPlan.findByPk(subscription.planId);
  if (!plan) return null;
  return { plan, subscription };
}

export async function assertCanCreateProject(tenantId: string): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const count = await Project.count({ where: { tenantId } });
  if (count >= active.plan.maxProjects) {
    throw new PlanLimitError(
      'LIMIT_PROJECTS',
      `Project limit reached (${active.plan.maxProjects}). Upgrade your plan.`
    );
  }
}

export async function syncProjectCount(tenantId: string): Promise<void> {
  const n = await Project.count({ where: { tenantId } });
  await TenantUsage.upsert({
    tenantId,
    projectCount: n,
    seatCount: (await TenantUsage.findByPk(tenantId))?.seatCount ?? 1,
    updatedAt: new Date(),
  });
}

export async function ensureTenantUsageRow(tenantId: string, seatCount = 1): Promise<void> {
  await TenantUsage.findOrCreate({
    where: { tenantId },
    defaults: { tenantId, projectCount: 0, seatCount, updatedAt: new Date() },
  });
}

export async function assertCanAddEmployeeSeat(tenantId: string): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const seats = await EmployeeProfile.count({
    where: { tenantId, deletedAt: { [Op.is]: null } },
  });
  if (seats >= active.plan.maxSeats) {
    throw new PlanLimitError(
      'LIMIT_SEATS',
      `Seat limit reached (${active.plan.maxSeats}). Upgrade your plan.`
    );
  }
}

export async function syncSeatCount(tenantId: string): Promise<void> {
  const n = await EmployeeProfile.count({
    where: { tenantId, deletedAt: { [Op.is]: null } },
  });
  const usage = await TenantUsage.findByPk(tenantId);
  await TenantUsage.upsert({
    tenantId,
    projectCount: usage?.projectCount ?? 0,
    seatCount: n,
    updatedAt: new Date(),
  });
}

/** Agents require an active subscription and `agents_enabled` on the plan feature flags. */
export async function assertCanCreateBoard(tenantId: string, projectId: string): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const max = active.plan.maxBoardsPerProject;
  if (max == null) return;
  const n = await Board.count({ where: { tenantId, projectId } });
  if (n >= max) {
    throw new PlanLimitError(
      'LIMIT_BOARDS',
      `Board limit reached (${max}) for this project. Upgrade your plan.`
    );
  }
}

export async function assertAgentsFeatureEnabled(tenantId: string): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const flags = active.plan.featureFlags as { agents_enabled?: boolean };
  if (flags.agents_enabled !== true) {
    throw new PlanLimitError('FEATURE_AGENTS_DISABLED', 'Agents are not enabled on your plan');
  }
}

/** Excel import limits per plan. Enterprise is unbounded; unrecognised codes default to Pro caps. */
const IMPORT_ROW_CAPS: Record<string, number | null> = {
  starter: 200,
  standard: 5000,
  pro: 50000,
  enterprise: null,
};

const IMPORT_RATE_CAPS: Record<string, number | null> = {
  starter: 2,
  standard: 10,
  pro: 30,
  enterprise: null,
};

export async function assertCanImportRowCount(tenantId: string, rowCount: number): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const cap = IMPORT_ROW_CAPS[active.plan.code] ?? IMPORT_ROW_CAPS.pro!;
  if (cap == null) return;
  if (rowCount > cap) {
    throw new PlanLimitError(
      'LIMIT_IMPORT_ROWS',
      `Import row limit reached (${cap} rows). Upgrade your plan or split the file.`
    );
  }
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * P12 — Generic in-memory sliding-window rate limiter used to throttle write-heavy
 * tenant operations (template save, bulk invites, webhook & notification fanout).
 *
 * Single-process / single-region only. Multi-instance API deployments should move
 * this to Redis (see `docs/ROADMAP-TODO-SPECS.md` P12 section for the migration path).
 */
const rateBuckets = new Map<string, number[]>();

function recordEvent(bucket: string, windowMs: number): { count: number; oldest: number | null } {
  const now = Date.now();
  const arr = (rateBuckets.get(bucket) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  rateBuckets.set(bucket, arr);
  return { count: arr.length, oldest: arr[0] ?? null };
}

function peekEvent(bucket: string, windowMs: number): { count: number; oldest: number | null } {
  const now = Date.now();
  const arr = (rateBuckets.get(bucket) ?? []).filter((t) => now - t < windowMs);
  return { count: arr.length, oldest: arr[0] ?? null };
}

export class TenantRateLimitError extends PlanLimitError {
  readonly retryAfterSeconds: number;

  constructor(code: string, message: string, retryAfterSeconds: number) {
    super(code, message);
    this.name = 'TenantRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, TenantRateLimitError.prototype);
  }
}

export type RateLimitWindow = 'minute' | 'hour';

/**
 * Throw if the tenant has exceeded `cap` events of `key` in the given window.
 * Records the event when not over the cap (atomic check-and-increment within a single Node loop tick).
 */
export function assertTenantRateLimit(input: {
  tenantId: string;
  key: string;
  cap: number;
  window?: RateLimitWindow;
  label?: string;
}): void {
  const windowMs = input.window === 'minute' ? MINUTE_MS : HOUR_MS;
  const bucket = `t:${input.tenantId}:${input.key}`;
  const { count: existing, oldest } = peekEvent(bucket, windowMs);
  if (existing >= input.cap) {
    const retryAfterMs = oldest != null ? Math.max(0, windowMs - (Date.now() - oldest)) : windowMs;
    throw new TenantRateLimitError(
      `LIMIT_RATE_${input.key.toUpperCase()}`,
      `${input.label ?? input.key} rate limit reached (${input.cap}/${input.window ?? 'hour'}). Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      Math.ceil(retryAfterMs / 1000)
    );
  }
  recordEvent(bucket, windowMs);
}

/**
 * Soft rate limit: returns `true` when the event was recorded, `false` when the cap is hit.
 * Use for background fanout (webhooks, notifications) where dropping is safer than throwing.
 */
export function tryTenantRateLimit(input: {
  tenantId: string;
  key: string;
  cap: number;
  window?: RateLimitWindow;
}): boolean {
  const windowMs = input.window === 'minute' ? MINUTE_MS : HOUR_MS;
  const bucket = `t:${input.tenantId}:${input.key}`;
  const { count } = peekEvent(bucket, windowMs);
  if (count >= input.cap) return false;
  recordEvent(bucket, windowMs);
  return true;
}

/** Per-user variant; used to throttle a single noisy actor inside a tenant. */
export function tryUserRateLimit(input: {
  userId: string;
  key: string;
  cap: number;
  window?: RateLimitWindow;
}): boolean {
  const windowMs = input.window === 'minute' ? MINUTE_MS : HOUR_MS;
  const bucket = `u:${input.userId}:${input.key}`;
  const { count } = peekEvent(bucket, windowMs);
  if (count >= input.cap) return false;
  recordEvent(bucket, windowMs);
  return true;
}

export async function assertImportRateLimit(tenantId: string): Promise<void> {
  const active = await getActivePlanForTenant(tenantId);
  if (!active) {
    throw new PlanLimitError('SUBSCRIPTION_INACTIVE', 'No active subscription for tenant');
  }
  const cap = IMPORT_RATE_CAPS[active.plan.code] ?? IMPORT_RATE_CAPS.pro!;
  if (cap == null) return;
  const bucket = `t:${tenantId}:import`;
  const { count, oldest } = peekEvent(bucket, HOUR_MS);
  if (count >= cap) {
    const retryAfterMs = oldest != null ? Math.max(0, HOUR_MS - (Date.now() - oldest)) : HOUR_MS;
    throw new TenantRateLimitError(
      'LIMIT_IMPORT_RATE',
      `Import rate limit reached (${cap} imports/hour). Try again later or upgrade your plan.`,
      Math.ceil(retryAfterMs / 1000)
    );
  }
  recordEvent(bucket, HOUR_MS);
}

/** For tests: clear all in-memory rate-limit windows (imports + generic tenant/user buckets). */
export function _resetImportRateLimit(): void {
  rateBuckets.clear();
}

/** Alias of `_resetImportRateLimit` with a clearer name for non-import tests. */
export function _resetRateLimits(): void {
  rateBuckets.clear();
}
