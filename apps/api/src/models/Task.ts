import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { TaskPriority } from '../types/task';

export interface TaskAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  boardId: string;
  key: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: string;
  assigneeType: string | null;
  assigneeId: string | null;
  createdBy: string | null;
  slaDeadline: Date | null;
  slaState: Record<string, unknown>;
  dependencies: string[];
  tags: string[];
  estimate: number | string | null;
  position: number;
  resolution: string | null;
  dueDate: string | null;
  startDate: string | null;
  metadata: Record<string, unknown>;
  parentTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type TaskCreation = Optional<
  TaskAttributes,
  | 'id'
  | 'description'
  | 'assigneeType'
  | 'assigneeId'
  | 'createdBy'
  | 'slaDeadline'
  | 'slaState'
  | 'dependencies'
  | 'tags'
  | 'boardId'
  | 'estimate'
  | 'position'
  | 'resolution'
  | 'dueDate'
  | 'startDate'
  | 'metadata'
  | 'parentTaskId'
  | 'createdAt'
  | 'updatedAt'
>;

export class Task extends Model<TaskAttributes, TaskCreation> implements TaskAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare boardId: string;
  declare key: string;
  declare title: string;
  declare description: string | null;
  declare priority: TaskPriority;
  declare status: string;
  declare assigneeType: string | null;
  declare assigneeId: string | null;
  declare createdBy: string | null;
  declare slaDeadline: Date | null;
  declare slaState: Record<string, unknown>;
  declare dependencies: string[];
  declare tags: string[];
  declare estimate: number | string | null;
  declare position: number;
  declare resolution: string | null;
  declare dueDate: string | null;
  declare startDate: string | null;
  declare metadata: Record<string, unknown>;
  declare parentTaskId: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Task.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    boardId: { type: DataTypes.UUID, allowNull: false, field: 'board_id' },
    key: { type: DataTypes.STRING(64), allowNull: false },
    title: { type: DataTypes.STRING(512), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.STRING(8), allowNull: false },
    status: { type: DataTypes.STRING(64), allowNull: false },
    assigneeType: { type: DataTypes.STRING(16), allowNull: true, field: 'assignee_type' },
    assigneeId: { type: DataTypes.STRING(64), allowNull: true, field: 'assignee_id' },
    createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
    slaDeadline: { type: DataTypes.DATE, allowNull: true, field: 'sla_deadline' },
    slaState: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'sla_state' },
    dependencies: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
    estimate: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    position: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
    resolution: { type: DataTypes.TEXT, allowNull: true },
    dueDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'due_date' },
    startDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'start_date' },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'metadata' },
    parentTaskId: { type: DataTypes.UUID, allowNull: true, field: 'parent_task_id' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tasks', underscored: true }
);
