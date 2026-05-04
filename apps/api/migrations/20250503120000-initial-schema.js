'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plans', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      code: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      display_name: { type: Sequelize.STRING(255), allowNull: false },
      max_projects: { type: Sequelize.INTEGER, allowNull: false },
      max_seats: { type: Sequelize.INTEGER, allowNull: false },
      feature_flags: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      stripe_price_id: { type: Sequelize.STRING(255), allowNull: true },
      monthly_price_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('tenants', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      billing_email: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      email: { type: Sequelize.STRING(320), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: true },
      first_name: { type: Sequelize.STRING(120), allowNull: false },
      last_name: { type: Sequelize.STRING(120), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('tenant_memberships', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: { type: Sequelize.STRING(32), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('tenant_memberships', {
      fields: ['user_id', 'tenant_id'],
      type: 'unique',
      name: 'tenant_memberships_user_tenant_unique',
    });
    await queryInterface.addIndex('tenant_memberships', ['tenant_id'], { name: 'idx_memberships_tenant' });
    await queryInterface.addIndex('tenant_memberships', ['user_id'], { name: 'idx_memberships_user' });

    await queryInterface.createTable('tenant_subscriptions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'subscription_plans', key: 'id' },
        onDelete: 'RESTRICT',
      },
      status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'trialing' },
      current_period_start: { type: Sequelize.DATE, allowNull: true },
      current_period_end: { type: Sequelize.DATE, allowNull: true },
      cancel_at_period_end: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      stripe_customer_id: { type: Sequelize.STRING(255), allowNull: true },
      stripe_subscription_id: { type: Sequelize.STRING(255), allowNull: true },
      trial_ends_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('tenant_subscriptions', ['tenant_id'], { name: 'idx_subscriptions_tenant' });

    await queryInterface.createTable('tenant_usage', {
      tenant_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      project_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      seat_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.createTable('refresh_tokens', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id'], { name: 'idx_refresh_user' });

    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('projects', ['tenant_id'], { name: 'idx_projects_tenant' });

    await queryInterface.createTable('stripe_events', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      stripe_event_id: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    const now = new Date();
    await queryInterface.bulkInsert('subscription_plans', [
      {
        id: randomUUID(),
        code: 'starter',
        display_name: 'Starter',
        max_projects: 2,
        max_seats: 5,
        feature_flags: JSON.stringify({ agents_enabled: false }),
        stripe_price_id: null,
        monthly_price_cents: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        code: 'pro',
        display_name: 'Pro',
        max_projects: 25,
        max_seats: 50,
        feature_flags: JSON.stringify({ agents_enabled: true }),
        stripe_price_id: null,
        monthly_price_cents: 4900,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        code: 'enterprise',
        display_name: 'Enterprise',
        max_projects: 9999,
        max_seats: 9999,
        feature_flags: JSON.stringify({ agents_enabled: true, audit_export: true }),
        stripe_price_id: null,
        monthly_price_cents: 19900,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stripe_events');
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('refresh_tokens');
    await queryInterface.dropTable('tenant_usage');
    await queryInterface.dropTable('tenant_subscriptions');
    await queryInterface.dropTable('tenant_memberships');
    await queryInterface.dropTable('users');
    await queryInterface.dropTable('tenants');
    await queryInterface.dropTable('subscription_plans');
  },
};
