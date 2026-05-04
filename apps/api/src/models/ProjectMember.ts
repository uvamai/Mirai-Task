import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ProjectMemberRole = 'LEAD' | 'CONTRIBUTOR' | 'VIEWER';

export interface ProjectMemberAttributes {
  id: string;
  tenantId: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectMemberCreation = Optional<ProjectMemberAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class ProjectMember
  extends Model<ProjectMemberAttributes, ProjectMemberCreation>
  implements ProjectMemberAttributes
{
  declare id: string;
  declare tenantId: string;
  declare projectId: string;
  declare userId: string;
  declare role: ProjectMemberRole;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProjectMember.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    role: { type: DataTypes.STRING(32), allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'project_members', underscored: true }
);
