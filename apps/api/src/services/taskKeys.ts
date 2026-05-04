import { Task } from '../models';

export async function nextTaskKey(tenantId: string): Promise<string> {
  const n = await Task.count({ where: { tenantId } });
  return `MIRAI-${n + 1}`;
}
