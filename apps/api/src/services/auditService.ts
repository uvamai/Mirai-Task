import type { Request } from 'express';
import { ActivityLog } from '../models';

export async function logActivity(params: {
  tenantId: string;
  taskId?: string | null;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  actorType: 'user' | 'agent' | 'system';
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  req?: Request;
}): Promise<void> {
  await ActivityLog.create({
    tenantId: params.tenantId,
    taskId: params.taskId ?? undefined,
    actorUserId: params.actorUserId ?? undefined,
    actorAgentId: params.actorAgentId ?? undefined,
    actorType: params.actorType,
    action: params.action,
    entityType: params.entityType ?? undefined,
    entityId: params.entityId ?? undefined,
    beforeJson: params.before ?? undefined,
    afterJson: params.after ?? undefined,
    payload:
      params.before != null || params.after != null
        ? { before: params.before ?? null, after: params.after ?? null }
        : undefined,
    requestId: params.req?.requestId ?? undefined,
  });
}
