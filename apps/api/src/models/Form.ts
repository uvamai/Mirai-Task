import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface FormAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  boardId: string; // The board where tasks will be created
  title: string;
  description: string | null;
  fields: any[]; // JSON array defining the form schema
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type FormCreation = Optional<
  FormAttributes,
  'id' | 'description' | 'fields' | 'isActive' | 'createdAt' | 'updatedAt'
>;

export class Form extends Model<FormAttributes, FormCreation> implements FormAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare boardId: string;
  declare title: string;
  declare description: string | null;
  declare fields: any[];
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Form.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    boardId: { type: DataTypes.UUID, allowNull: false, field: 'board_id' },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    fields: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'forms', underscored: true }
);
