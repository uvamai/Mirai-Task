import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface EmployeeProfileAttributes {
  id: string;
  tenantId: string;
  userId: string;
  phone: string | null;
  department: string | null;
  managerId: string | null;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type EmployeeProfileCreation = Optional<
  EmployeeProfileAttributes,
  'id' | 'phone' | 'department' | 'managerId' | 'avatarUrl' | 'metadata' | 'deletedAt' | 'createdAt' | 'updatedAt'
>;

export class EmployeeProfile
  extends Model<EmployeeProfileAttributes, EmployeeProfileCreation>
  implements EmployeeProfileAttributes
{
  declare id: string;
  declare tenantId: string;
  declare userId: string;
  declare phone: string | null;
  declare department: string | null;
  declare managerId: string | null;
  declare avatarUrl: string | null;
  declare metadata: Record<string, unknown>;
  declare deletedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

EmployeeProfile.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    phone: { type: DataTypes.STRING(64), allowNull: true },
    department: { type: DataTypes.STRING(255), allowNull: true },
    managerId: { type: DataTypes.UUID, allowNull: true, field: 'manager_id' },
    avatarUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'avatar_url' },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'employee_profiles', underscored: true, paranoid: false }
);
