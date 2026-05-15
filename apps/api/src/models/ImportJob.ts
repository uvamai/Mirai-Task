import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ImportJobState = 'queued' | 'running' | 'completed' | 'failed';

export interface ImportJobAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  userId: string;
  kind: string;
  state: ImportJobState;
  uploadId: string;
  boardId: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  lastError: string | null;
  attempts: number;
  leaseUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type ImportJobCreation = Optional<
  ImportJobAttributes,
  'id' | 'kind' | 'state' | 'boardId' | 'result' | 'lastError' | 'attempts' | 'leaseUntil' | 'createdAt' | 'updatedAt'
>;

export class ImportJob extends Model<ImportJobAttributes, ImportJobCreation> implements ImportJobAttributes {
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare userId: string;
  declare kind: string;
  declare state: ImportJobState;
  declare uploadId: string;
  declare boardId: string | null;
  declare payload: Record<string, unknown>;
  declare result: Record<string, unknown> | null;
  declare lastError: string | null;
  declare attempts: number;
  declare leaseUntil: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ImportJob.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    kind: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'excel' },
    state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'queued' },
    uploadId: { type: DataTypes.STRING(64), allowNull: false, field: 'upload_id' },
    boardId: { type: DataTypes.UUID, allowNull: true, field: 'board_id' },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    result: { type: DataTypes.JSONB, allowNull: true },
    lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    leaseUntil: { type: DataTypes.DATE, allowNull: true, field: 'lease_until' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'import_jobs', underscored: true }
);
