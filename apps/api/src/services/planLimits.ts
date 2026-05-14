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
