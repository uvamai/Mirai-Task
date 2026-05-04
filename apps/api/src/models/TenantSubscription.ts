import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TenantSubscriptionAttributes {
  id: string;
  tenantId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type TenantSubscriptionCreation = Optional<
  TenantSubscriptionAttributes,
  | 'id'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'cancelAtPeriodEnd'
  | 'stripeCustomerId'
  | 'stripeSubscriptionId'
  | 'trialEndsAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class TenantSubscription
  extends Model<TenantSubscriptionAttributes, TenantSubscriptionCreation>
  implements TenantSubscriptionAttributes
{
  declare id: string;
  declare tenantId: string;
  declare planId: string;
  declare status: string;
  declare currentPeriodStart: Date | null;
  declare currentPeriodEnd: Date | null;
  declare cancelAtPeriodEnd: boolean;
  declare stripeCustomerId: string | null;
  declare stripeSubscriptionId: string | null;
  declare trialEndsAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TenantSubscription.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenantId: { type: DataTypes.UUID, allowNull: false, field: 'tenant_id' },
    planId: { type: DataTypes.UUID, allowNull: false, field: 'plan_id' },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'trialing' },
    currentPeriodStart: { type: DataTypes.DATE, allowNull: true, field: 'current_period_start' },
    currentPeriodEnd: { type: DataTypes.DATE, allowNull: true, field: 'current_period_end' },
    cancelAtPeriodEnd: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'cancel_at_period_end' },
    stripeCustomerId: { type: DataTypes.STRING(255), allowNull: true, field: 'stripe_customer_id' },
    stripeSubscriptionId: { type: DataTypes.STRING(255), allowNull: true, field: 'stripe_subscription_id' },
    trialEndsAt: { type: DataTypes.DATE, allowNull: true, field: 'trial_ends_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  { sequelize, tableName: 'tenant_subscriptions', underscored: true }
);
