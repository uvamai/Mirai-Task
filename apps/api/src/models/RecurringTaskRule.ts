import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { TaskPriority } from '../types/task';

export interface RecurringTaskRuleAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  boardId: string;
  title: string;
  status: string;
  priority: TaskPriority;
  assigneeUserId: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  intervalCount: number;
  startDate: string;
  endDate: string | null;
  nextRunAt: Date;
  lastGeneratedAt: Date | null;
  active: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type Creation = Optional<
  RecurringTaskRuleAttributes,
  | 'id'
  | 'assigneeUserId'
  | 'endDate'
  | 'lastGeneratedAt'
  | 'active'
  | 'createdByUserId'
  | 'createdAt'
  | 'updatedAt'
>;

export class RecurringTaskRule extends Model<RecurringTaskRuleAttributes, Creation> implements RecurringTaskRuleAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare boardId: string;
  declare title: string;
  declare status: string;
  declare priority: TaskPriority;
  declare assigneeUserId: string | null;
  declare frequency: 'daily' | 'weekly' | 'monthly';
  declare intervalCount: number;
  declare startDate: string;
  declare endDate: string | null;
  declare nextRunAt: Date;
  declare lastGeneratedAt: Date | null;
  declare active: boolean;
  declare createdByUserId: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

RecurringTaskRule.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    boardId: { type: DataTypes.UUID, allowNull: false, field: 'board_id' },
    title: { type: DataTypes.STRING(512), allowNull: false },
    status: { type: DataTypes.STRING(64), allowNull: false },
    priority: { type: DataTypes.STRING(8), allowNull: false },
    assigneeUserId: { type: DataTypes.UUID, allowNull: true, field: 'assignee_user_id' },
    frequency: { type: DataTypes.STRING(16), allowNull: false },
    intervalCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'interval_count' },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
    endDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'end_date' },
    nextRunAt: { type: DataTypes.DATE, allowNull: false, field: 'next_run_at' },
    lastGeneratedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_generated_at' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true, field: 'created_by_user_id' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'recurring_task_rules', underscored: true }
);
