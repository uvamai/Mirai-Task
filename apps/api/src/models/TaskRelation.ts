import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type TaskRelationType = 'related';

export interface TaskRelationAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  fromTaskId: string;
  toTaskId: string;
  type: TaskRelationType;
  createdAt: Date;
  updatedAt: Date;
}

type TaskRelationCreation = Optional<TaskRelationAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class TaskRelation
  extends Model<TaskRelationAttributes, TaskRelationCreation>
  implements TaskRelationAttributes
{
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare fromTaskId: string;
  declare toTaskId: string;
  declare type: TaskRelationType;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TaskRelation.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    fromTaskId: { type: DataTypes.UUID, allowNull: false, field: 'from_task_id' },
    toTaskId: { type: DataTypes.UUID, allowNull: false, field: 'to_task_id' },
    type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'related' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'task_relations', underscored: true }
);

