import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ProjectAttributes {
  id: string;
  tenantId: string;
  name: string;
  prdContent: string | null;
  timeline: Record<string, unknown> | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectCreation = Optional<ProjectAttributes, 'id' | 'prdContent' | 'timeline' | 'settings' | 'createdAt' | 'updatedAt'>;

export class Project extends Model<ProjectAttributes, ProjectCreation> implements ProjectAttributes {
  declare id: string;
  declare tenantId: string;
  declare name: string;
  declare prdContent: string | null;
  declare timeline: Record<string, unknown> | null;
  declare settings: Record<string, unknown>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Project.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    name: { type: DataTypes.STRING(255), allowNull: false },
    prdContent: { type: DataTypes.TEXT, allowNull: true, field: 'prd_content' },
    timeline: { type: DataTypes.JSONB, allowNull: true },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'projects', underscored: true }
);
