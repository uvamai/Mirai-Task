'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_notifications', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING(32), allowNull: false },
      title: { type: Sequelize.STRING(512), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      dedupe_key: { type: Sequelize.STRING(256), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('user_notifications', ['tenant_id', 'user_id', 'created_at'], {
      name: 'idx_user_notifications_tenant_user_created',
    });
    await queryInterface.addIndex('user_notifications', ['tenant_id', 'user_id', 'read_at'], {
      name: 'idx_user_notifications_tenant_user_read',
    });
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS user_notifications_dedupe_unique
       ON user_notifications (tenant_id, dedupe_key)
       WHERE dedupe_key IS NOT NULL`
    );

    await queryInterface.createTable('recurring_task_rules', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      project_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'projects', key: 'id' }, onDelete: 'CASCADE' },
      board_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'boards', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(512), allowNull: false },
      status: { type: Sequelize.STRING(64), allowNull: false },
      priority: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'P3' },
      assignee_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      frequency: { type: Sequelize.STRING(16), allowNull: false },
      interval_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      next_run_at: { type: Sequelize.DATE, allowNull: false },
      last_generated_at: { type: Sequelize.DATE, allowNull: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('recurring_task_rules', ['tenant_id', 'active', 'next_run_at'], {
      name: 'idx_recurring_rules_tenant_active_next',
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS user_notifications_dedupe_unique');
    await queryInterface.dropTable('recurring_task_rules');
    await queryInterface.dropTable('user_notifications');
  },
};
