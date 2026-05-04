import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface ContactSalesLeadAttributes {
  id: string;
  name: string;
  workEmail: string;
  company: string;
  teamSize: string;
  message: string;
  source: string | null;
  createdAt: Date;
}

type Creation = Optional<ContactSalesLeadAttributes, 'id' | 'source' | 'createdAt'>;

export class ContactSalesLead
  extends Model<ContactSalesLeadAttributes, Creation>
  implements ContactSalesLeadAttributes
{
  declare id: string;
  declare name: string;
  declare workEmail: string;
  declare company: string;
  declare teamSize: string;
  declare message: string;
  declare source: string | null;
  declare createdAt: Date;
}

ContactSalesLead.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(200), allowNull: false },
    workEmail: { type: DataTypes.STRING(320), allowNull: false, field: 'work_email' },
    company: { type: DataTypes.STRING(255), allowNull: false },
    teamSize: { type: DataTypes.STRING(32), allowNull: false, field: 'team_size' },
    message: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.STRING(64), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'contact_sales_leads', underscored: true, updatedAt: false }
);
