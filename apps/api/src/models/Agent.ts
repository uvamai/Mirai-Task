import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface AgentAttributes {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  apiKeyHash: string;
  permissions: Record<string, unknown>;
  createdAt: Date;
}

type AgentCreation = Optional<AgentAttributes, 'id' | 'type' | 'permissions' | 'createdAt'>;

export class Agent extends Model<AgentAttributes, AgentCreation> implements AgentAttributes {
  declare id: string;
  declare tenantId: string;
  declare name: string;
  declare type: string;
  declare apiKeyHash: string;
  declare permissions: Record<string, unknown>;
  declare createdAt: Date;
}

Agent.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    name: { type: DataTypes.STRING(255), allowNull: false },
    type: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'orchestrator' },
    apiKeyHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'api_key_hash' },
    permissions: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'agents', underscored: true, updatedAt: false }
);
