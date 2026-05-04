import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ActivityLogAttributes {
  id: string;
  tenantId: string;
  taskId: string | null;
  actorUserId: string | null;
  actorAgentId: string | null;
  actorType: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: Date;
}

type ActivityLogCreation = Optional<
  ActivityLogAttributes,
  | 'id'
  | 'taskId'
  | 'actorUserId'
  | 'actorAgentId'
  | 'entityType'
  | 'entityId'
  | 'beforeJson'
  | 'afterJson'
  | 'payload'
  | 'requestId'
  | 'createdAt'
>;

export class ActivityLog extends Model<ActivityLogAttributes, ActivityLogCreation> implements ActivityLogAttributes {
  declare id: string;
  declare tenantId: string;
  declare taskId: string | null;
  declare actorUserId: string | null;
  declare actorAgentId: string | null;
  declare actorType: string;
  declare action: string;
  declare entityType: string | null;
  declare entityId: string | null;
  declare beforeJson: Record<string, unknown> | null;
  declare afterJson: Record<string, unknown> | null;
  declare payload: Record<string, unknown> | null;
  declare requestId: string | null;
  declare createdAt: Date;
}

ActivityLog.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    taskId: { type: DataTypes.UUID, allowNull: true, field: 'task_id' },
    actorUserId: { type: DataTypes.UUID, allowNull: true, field: 'actor_user_id' },
    actorAgentId: { type: DataTypes.UUID, allowNull: true, field: 'actor_agent_id' },
    actorType: { type: DataTypes.STRING(16), allowNull: false, field: 'actor_type' },
    action: { type: DataTypes.STRING(128), allowNull: false },
    entityType: { type: DataTypes.STRING(64), allowNull: true, field: 'entity_type' },
    entityId: { type: DataTypes.UUID, allowNull: true, field: 'entity_id' },
    beforeJson: { type: DataTypes.JSONB, allowNull: true, field: 'before_json' },
    afterJson: { type: DataTypes.JSONB, allowNull: true, field: 'after_json' },
    payload: { type: DataTypes.JSONB, allowNull: true },
    requestId: { type: DataTypes.UUID, allowNull: true, field: 'request_id' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'activity_logs', underscored: true, updatedAt: false }
);
