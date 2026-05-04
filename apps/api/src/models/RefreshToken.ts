import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface RefreshTokenAttributes {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

type RefreshTokenCreation = Optional<RefreshTokenAttributes, 'id' | 'createdAt'>;

export class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreation> implements RefreshTokenAttributes {
  declare id: string;
  declare userId: string;
  declare tenantId: string;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare createdAt: Date;
}

RefreshToken.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  },
  { sequelize, tableName: 'refresh_tokens', underscored: true, updatedAt: false }
);
