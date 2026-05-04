import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type MembershipRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'GUEST';

export interface TenantMembershipAttributes {
  id: string;
  userId: string;
  tenantId: string;
  role: MembershipRole;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type TenantMembershipCreation = Optional<
  TenantMembershipAttributes,
  'id' | 'preferences' | 'createdAt' | 'updatedAt'
>;

export class TenantMembership
  extends Model<TenantMembershipAttributes, TenantMembershipCreation>
  implements TenantMembershipAttributes
{
  declare id: string;
  declare userId: string;
  declare tenantId: string;
  declare role: MembershipRole;
  declare preferences: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TenantMembership.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    role: { type: DataTypes.STRING(32), allowNull: false },
    preferences: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tenant_memberships', underscored: true }
);
