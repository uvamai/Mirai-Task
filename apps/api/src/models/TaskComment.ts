import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import type { User } from './User';

export interface TaskCommentAttributes {
  id: string;
  tenantId: string;
  taskId: string;
  authorUserId: string;
  body: string;
  mentions: string[];
  createdAt: Date;
}

type Creation = Optional<TaskCommentAttributes, 'id' | 'createdAt' | 'mentions'>;

export class TaskComment extends Model<TaskCommentAttributes, Creation> implements TaskCommentAttributes {
  declare id: string;
  declare tenantId: string;
  declare taskId: string;
  declare authorUserId: string;
  declare body: string;
  declare mentions: string[];
  declare createdAt: Date;
  declare AuthorUser?: User;
}

TaskComment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    taskId: { type: DataTypes.UUID, allowNull: false, field: 'task_id' },
    authorUserId: { type: DataTypes.UUID, allowNull: false, field: 'author_user_id' },
    body: { type: DataTypes.TEXT, allowNull: false },
    mentions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'task_comments', underscored: true, updatedAt: false }
);
