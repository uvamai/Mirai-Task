import type { Task } from '../models/Task';
import type { Project } from '../models/Project';
import { fireProjectWebhooks, type WebhookEvent } from './outboundWebhook';
import { logger } from '../logger';

type WhenClause = { field: 'status' | 'priority'; op: 'eq'; value: string };
type ThenClause =
  | { action: 'webhook'; event: WebhookEvent }
  | { action: 'set_priority'; value: string };

export type AutomationRule = { id: string; when: WhenClause; then: ThenClause };

function isAutomationRule(r: unknown): r is AutomationRule {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  const when = o.when as WhenClause | undefined;
  const then = o.then as Record<string, unknown> | undefined;
  if (typeof o.id !== 'string' || !when || !then) return false;
  if (!['status', 'priority'].includes(when.field) || when.op !== 'eq' || typeof when.value !== 'string') {
    return false;
  }
  if (then.action === 'webhook' && typeof then.event === 'string') return true;
  if (
    then.action === 'set_priority' &&
    typeof then.value === 'string' &&
    ['P0', 'P1', 'P2', 'P3', 'P4'].includes(then.value)
  ) {
    return true;
  }
  return false;
}

function parseRules(raw: unknown): AutomationRule[] {
  const arr = raw as unknown[];
  if (!Array.isArray(arr)) return [];
  return arr.filter(isAutomationRule).slice(0, 20);
}

function matches(when: WhenClause, changed: { status?: string; priority?: string }): boolean {
  if (when.field === 'status') return changed.status === when.value;
  return changed.priority === when.value;
}

/**
 * Runs after a successful task update. Mutates `task` only for `set_priority` actions (caller must save again if needed).
 */
export async function runAutomationsAfterTaskUpdate(options: {
  project: Project;
  task: Task;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}): Promise<void> {
  const rules = parseRules(options.project.settings?.automations);
  if (!rules.length) return;
  const changed: { status?: string; priority?: string } = {};
  if (options.before.status !== options.after.status) changed.status = String(options.after.status ?? '');
  if (options.before.priority !== options.after.priority) changed.priority = String(options.after.priority ?? '');
  if (!changed.status && !changed.priority) return;

  for (const rule of rules) {
    if (!matches(rule.when, changed)) continue;
    try {
      if (rule.then.action === 'webhook') {
        await fireProjectWebhooks({
          settings: options.project.settings,
          event: rule.then.event,
          payload: {
            ruleId: rule.id,
            taskId: options.task.id,
            key: options.task.key,
            status: options.task.status,
            priority: options.task.priority,
          },
          projectId: options.project.id,
          tenantId: options.project.tenantId,
        });
      } else if (rule.then.action === 'set_priority') {
        (options.task as { priority: string }).priority = rule.then.value;
        await options.task.save();
      }
    } catch (e) {
      logger.error('automation rule failed', { ruleId: rule.id, err: e });
    }
  }
}
