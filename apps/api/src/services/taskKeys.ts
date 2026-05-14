import { Transaction } from 'sequelize';
import { Task } from '../models';

export async function nextTaskKey(tenantId: string, transaction?: Transaction): Promise<string> {
  const n = await Task.count({ where: { tenantId }, transaction });
  return `MIRAI-${n + 1}`;
}
