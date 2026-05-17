import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TenantIntegrationAttributes {
  id: string;
  tenantId: string;
  provider: string; // 'openai', 'anthropic', 'salesforce', 'bamboo_hr'
  encryptedConfig: Record<string, unknown>; // Symmetric encrypted JSON
  status: string; // 'active', 'inactive', 'error'
  createdAt: Date;
  updatedAt: Date;
}

type TenantIntegrationCreation = Optional<TenantIntegrationAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

export class TenantIntegration extends Model<TenantIntegrationAttributes, TenantIntegrationCreation> implements TenantIntegrationAttributes {
  declare id: string;
  declare tenantId: string;
  declare provider: string;
  declare encryptedConfig: Record<string, unknown>;
  declare status: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TenantIntegration.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    provider: { type: DataTypes.STRING(128), allowNull: false },
    encryptedConfig: { type: DataTypes.JSONB, allowNull: false, field: 'encrypted_config' },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'active' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tenant_integrations', underscored: true }
);
