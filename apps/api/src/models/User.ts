import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string | null;
  isLoginActive: boolean;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

type UserCreation = Optional<UserAttributes, 'id' | 'passwordHash' | 'isLoginActive' | 'createdAt' | 'updatedAt'>;

export class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: string;
  declare email: string;
  declare passwordHash: string | null;
  declare isLoginActive: boolean;
  declare firstName: string;
  declare lastName: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: true, field: 'password_hash' },
    isLoginActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_login_active' },
    firstName: { type: DataTypes.STRING(120), allowNull: false, field: 'first_name' },
    lastName: { type: DataTypes.STRING(120), allowNull: false, field: 'last_name' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'users', underscored: true }
);
