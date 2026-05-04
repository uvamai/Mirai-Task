import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface BoardAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  templateKey: string | null;
  settings: Record<string, unknown>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

type BoardCreation = Optional<
  BoardAttributes,
  'id' | 'templateKey' | 'settings' | 'position' | 'createdAt' | 'updatedAt'
>;

export class Board extends Model<BoardAttributes, BoardCreation> implements BoardAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare name: string;
  declare templateKey: string | null;
  declare settings: Record<string, unknown>;
  declare position: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Board.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    name: { type: DataTypes.STRING(255), allowNull: false },
    templateKey: { type: DataTypes.STRING(64), allowNull: true, field: 'template_key' },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    position: { type: DataTypes.DOUBLE, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'boards', underscored: true }
);
