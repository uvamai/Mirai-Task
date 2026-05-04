import { Task } from '../models';

export async function assertValidParentTask(options: {
  taskId?: string;
  parentTaskId: string | null | undefined;
  tenantId: string;
  projectId: string;
}): Promise<void> {
  const pid = options.parentTaskId;
  if (!pid) return;
  if (options.taskId && pid === options.taskId) {
    throw new Error('Task cannot be its own parent');
  }
  const parent = await Task.findOne({
    where: { id: pid, tenantId: options.tenantId, projectId: options.projectId },
  });
  if (!parent) {
    throw new Error('Parent task not found in this project');
  }
  if (options.taskId) {
    const seen = new Set<string>();
    let cur: string | null = pid;
    for (let i = 0; i < 64 && cur; i++) {
      if (cur === options.taskId) {
        throw new Error('Parent link would create a cycle');
      }
      if (seen.has(cur)) break;
      seen.add(cur);
      const row: Pick<Task, 'parentTaskId'> | null = await Task.findOne({
        where: { id: cur, tenantId: options.tenantId },
        attributes: ['parentTaskId'],
      });
      cur = row?.parentTaskId ?? null;
    }
  }
}
