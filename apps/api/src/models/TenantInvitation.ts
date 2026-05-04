import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TenantInvitationAttributes {
  id: string;
  tenantId: string;
  email: string;
  membershipRole: string;
  tokenHash: string;
  invitedByUserId: string | null; // null if inviter account removed
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  createdAt: Date;
}

type Creation = Optional<TenantInvitationAttributes, 'id' | 'acceptedAt' | 'acceptedUserId' | 'invitedByUserId' | 'createdAt'>;

export class TenantInvitation extends Model<TenantInvitationAttributes, Creation> implements TenantInvitationAttributes {
  declare id: string;
  declare tenantId: string;
  declare email: string;
  declare membershipRole: string;
  declare tokenHash: string;
  declare invitedByUserId: string | null;
  declare expiresAt: Date;
  declare acceptedAt: Date | null;
  declare acceptedUserId: string | null;
  declare createdAt: Date;
}

TenantInvitation.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    email: { type: DataTypes.STRING(320), allowNull: false },
    membershipRole: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'EMPLOYEE', field: 'membership_role' },
    tokenHash: { type: DataTypes.STRING(128), allowNull: false, field: 'token_hash' },
    invitedByUserId: { type: DataTypes.UUID, allowNull: true, field: 'invited_by_user_id' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    acceptedAt: { type: DataTypes.DATE, allowNull: true, field: 'accepted_at' },
    acceptedUserId: { type: DataTypes.UUID, allowNull: true, field: 'accepted_user_id' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'tenant_invitations', underscored: true, updatedAt: false }
);
