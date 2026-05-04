import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ReassignmentAttributes {
  id: string;
  tenantId: string;
  taskId: string;
  fromAssigneeType: string | null;
  fromAssigneeId: string | null;
  toAssigneeType: string | null;
  toAssigneeId: string | null;
  reason: string;
  actorUserId: string | null;
  isAutomatic: boolean;
  createdAt: Date;
}

type ReassignmentCreation = Optional<
  ReassignmentAttributes,
  'id' | 'fromAssigneeType' | 'fromAssigneeId' | 'toAssigneeType' | 'toAssigneeId' | 'actorUserId' | 'isAutomatic' | 'createdAt'
>;

export class Reassignment extends Model<ReassignmentAttributes, ReassignmentCreation> implements ReassignmentAttributes {
  declare id: string;
  declare tenantId: string;
  declare taskId: string;
  declare fromAssigneeType: string | null;
  declare fromAssigneeId: string | null;
  declare toAssigneeType: string | null;
  declare toAssigneeId: string | null;
  declare reason: string;
  declare actorUserId: string | null;
  declare isAutomatic: boolean;
  declare createdAt: Date;
}

Reassignment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    taskId: { type: DataTypes.UUID, allowNull: false, field: 'task_id' },
    fromAssigneeType: { type: DataTypes.STRING(16), allowNull: true, field: 'from_assignee_type' },
    fromAssigneeId: { type: DataTypes.STRING(64), allowNull: true, field: 'from_assignee_id' },
    toAssigneeType: { type: DataTypes.STRING(16), allowNull: true, field: 'to_assignee_type' },
    toAssigneeId: { type: DataTypes.STRING(64), allowNull: true, field: 'to_assignee_id' },
    reason: { type: DataTypes.TEXT, allowNull: false },
    actorUserId: { type: DataTypes.UUID, allowNull: true, field: 'actor_user_id' },
    isAutomatic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_automatic' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'reassignments', underscored: true, updatedAt: false }
);
