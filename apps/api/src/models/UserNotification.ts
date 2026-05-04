import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface UserNotificationAttributes {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

type Creation = Optional<UserNotificationAttributes, 'id' | 'body' | 'readAt' | 'dedupeKey' | 'metadata' | 'createdAt'>;

export class UserNotification extends Model<UserNotificationAttributes, Creation> implements UserNotificationAttributes {
  declare id: string;
  declare tenantId: string;
  declare userId: string;
  declare type: string;
  declare title: string;
  declare body: string | null;
  declare readAt: Date | null;
  declare dedupeKey: string | null;
  declare metadata: Record<string, unknown>;
  declare createdAt: Date;
}

UserNotification.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    type: { type: DataTypes.STRING(32), allowNull: false },
    title: { type: DataTypes.STRING(512), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: true },
    readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
    dedupeKey: { type: DataTypes.STRING(256), allowNull: true, field: 'dedupe_key' },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'user_notifications', underscored: true, updatedAt: false }
);
