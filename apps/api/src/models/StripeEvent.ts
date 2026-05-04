import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface StripeEventAttributes {
  id: string;
  stripeEventId: string;
  receivedAt: Date;
}

type StripeEventCreation = Optional<StripeEventAttributes, 'id' | 'receivedAt'>;

export class StripeEvent extends Model<StripeEventAttributes, StripeEventCreation> implements StripeEventAttributes {
  declare id: string;
  declare stripeEventId: string;
  declare receivedAt: Date;
}

StripeEvent.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    stripeEventId: { type: DataTypes.STRING(255), allowNull: false, unique: true, field: 'stripe_event_id' },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'received_at' },
  },
  { sequelize, tableName: 'stripe_events', underscored: true, updatedAt: false }
);
