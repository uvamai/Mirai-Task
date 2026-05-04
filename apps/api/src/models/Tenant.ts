import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TenantAttributes {
  id: string;
  name: string;
  slug: string;
  billingEmail: string | null;
  status: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type TenantCreation = Optional<TenantAttributes, 'id' | 'billingEmail' | 'status' | 'settings' | 'createdAt' | 'updatedAt'>;

export class Tenant extends Model<TenantAttributes, TenantCreation> implements TenantAttributes {
  declare id: string;
  declare name: string;
  declare slug: string;
  declare billingEmail: string | null;
  declare status: string;
  declare settings: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Tenant.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    billingEmail: { type: DataTypes.STRING(255), allowNull: true, field: 'billing_email' },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'active' },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tenants', underscored: true }
);
