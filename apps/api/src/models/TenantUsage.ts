import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TenantUsageAttributes {
  tenantId: string;
  projectCount: number;
  seatCount: number;
  updatedAt: Date;
}

type TenantUsageCreation = Optional<TenantUsageAttributes, 'projectCount' | 'seatCount' | 'updatedAt'>;

export class TenantUsage extends Model<TenantUsageAttributes, TenantUsageCreation> implements TenantUsageAttributes {
  declare tenantId: string;
  declare projectCount: number;
  declare seatCount: number;
  declare updatedAt: Date;
}

TenantUsage.init(
  {
    tenantId: { type: DataTypes.UUID, primaryKey: true, field: 'tenant_id' },
    projectCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'project_count' },
    seatCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'seat_count' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tenant_usage', underscored: true, timestamps: false }
);
