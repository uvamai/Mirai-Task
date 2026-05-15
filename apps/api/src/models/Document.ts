import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface DocumentAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  content: Record<string, unknown>; // Tiptap/ProseMirror JSON
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type DocumentCreation = Optional<
  DocumentAttributes,
  'id' | 'content' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>;

export class Document extends Model<DocumentAttributes, DocumentCreation> implements DocumentAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare title: string;
  declare content: Record<string, unknown>;
  declare createdBy: string | null;
  declare updatedBy: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Document.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    title: { type: DataTypes.STRING(512), allowNull: false },
    content: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
    updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'documents', underscored: true }
);
