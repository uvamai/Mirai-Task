import { createHmac } from 'crypto';
import { Project } from '../models';
import { logger } from '../logger';
import { tryTenantRateLimit } from './planLimits';

export type WebhookEvent =
  | 'task.assigned'
  | 'task.updated'
  | 'sla.warning'
  | 'sla.soft_breach'
  | 'board.imported';

export type ProjectWebhook = {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
};

export type WebhookDeliveryEntry = {
  at: string;
  webhookId: string;
  event: WebhookEvent;
  ok: boolean;
  httpStatus?: number;
};

function parseWebhooks(raw: unknown): ProjectWebhook[] {
  const arr = raw as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((w): w is ProjectWebhook => {
      if (!w || typeof w !== 'object') return false;
      const o = w as Record<string, unknown>;
      return typeof o.id === 'string' && typeof o.url === 'string' && typeof o.secret === 'string' && Array.isArray(o.events);
    })
    .slice(0, 10);
}

export function getProjectWebhooks(settings: Record<string, unknown>): ProjectWebhook[] {
  return parseWebhooks(settings.webhooks);
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function postWithRetry(url: string, secret: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status?: number }> {
  const body = JSON.stringify(payload);
  const sig = sign(secret, body);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mirai-Signature': `sha256=${sig}`,
          'X-Mirai-Delivery': String(attempt + 1),
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { ok: true, status: res.status };
    } catch (e) {
      logger.warn('webhook delivery failed', { url, attempt, err: e });
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return { ok: false };
}

async function appendWebhookDeliveryLog(
  tenantId: string,
  projectId: string,
  entries: WebhookDeliveryEntry[]
): Promise<void> {
  if (!entries.length) return;
  try {
    const project = await Project.findOne({ where: { id: projectId, tenantId } });
    if (!project) return;
    const prev = (project.settings?.webhookDeliveryLog as unknown[]) ?? [];
    const next = [...prev, ...entries].slice(-100);
    project.settings = { ...project.settings, webhookDeliveryLog: next };
    await project.save();
  } catch (e) {
    logger.warn('webhook delivery log append failed', { err: e, projectId });
  }
}

/**
 * P12 — soft cap so a misbehaving project can't burst outbound deliveries from
 * a tight automation loop. 120 fires / minute / tenant feels generous for normal
 * traffic and below most provider rate limits. Drops silently with a warn.
 */
const WEBHOOK_FANOUT_CAP_PER_MINUTE = 120;

export async function fireProjectWebhooks(options: {
  settings: Record<string, unknown>;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  projectId?: string;
  tenantId?: string;
}): Promise<void> {
  const hooks = getProjectWebhooks(options.settings);
  const body = { event: options.event, ...options.payload, sentAt: new Date().toISOString() };
  const entries: WebhookDeliveryEntry[] = [];
  for (const h of hooks) {
    if (!h.events.includes(options.event)) continue;
    if (options.tenantId) {
      const allowed = tryTenantRateLimit({
        tenantId: options.tenantId,
        key: 'webhook_fanout',
        cap: WEBHOOK_FANOUT_CAP_PER_MINUTE,
        window: 'minute',
      });
      if (!allowed) {
        logger.warn('webhook fanout dropped — tenant rate limit', {
          tenantId: options.tenantId,
          projectId: options.projectId,
          event: options.event,
          webhookId: h.id,
        });
        entries.push({
          at: new Date().toISOString(),
          webhookId: h.id,
          event: options.event,
          ok: false,
          httpStatus: 0,
        });
        continue;
      }
    }
    const r = await postWithRetry(h.url, h.secret, body);
    entries.push({
      at: new Date().toISOString(),
      webhookId: h.id,
      event: options.event,
      ok: r.ok,
      httpStatus: r.status,
    });
  }
  if (options.projectId && options.tenantId && entries.length) {
    await appendWebhookDeliveryLog(options.tenantId, options.projectId, entries);
  }
}
