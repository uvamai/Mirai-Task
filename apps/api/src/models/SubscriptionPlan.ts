import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface SubscriptionPlanAttributes {
  id: string;
  code: string;
  displayName: string;
  maxProjects: number;
  maxSeats: number;
  maxBoardsPerProject: number | null;
  featureFlags: Record<string, unknown>;
  stripePriceId: string | null;
  monthlyPriceCents: number;
  createdAt: Date;
  updatedAt: Date;
}

type SubscriptionPlanCreation = Optional<
  SubscriptionPlanAttributes,
  'id' | 'maxBoardsPerProject' | 'featureFlags' | 'stripePriceId' | 'monthlyPriceCents' | 'createdAt' | 'updatedAt'
>;

export class SubscriptionPlan
  extends Model<SubscriptionPlanAttributes, SubscriptionPlanCreation>
  implements SubscriptionPlanAttributes
{
  declare id: string;
  declare code: string;
  declare displayName: string;
  declare maxProjects: number;
  declare maxSeats: number;
  declare maxBoardsPerProject: number | null;
  declare featureFlags: Record<string, unknown>;
  declare stripePriceId: string | null;
  declare monthlyPriceCents: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

SubscriptionPlan.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    displayName: { type: DataTypes.STRING(255), allowNull: false, field: 'display_name' },
    maxProjects: { type: DataTypes.INTEGER, allowNull: false, field: 'max_projects' },
    maxSeats: { type: DataTypes.INTEGER, allowNull: false, field: 'max_seats' },
    maxBoardsPerProject: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'max_boards_per_project',
    },
    featureFlags: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'feature_flags' },
    stripePriceId: { type: DataTypes.STRING(255), allowNull: true, field: 'stripe_price_id' },
    monthlyPriceCents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'monthly_price_cents' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'subscription_plans', underscored: true }
);
