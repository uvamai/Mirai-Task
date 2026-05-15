'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('import_jobs', {
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
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      kind: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'excel' },
      state: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'queued' },
      upload_id: { type: Sequelize.STRING(64), allowNull: false },
      board_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'boards', key: 'id' },
        onDelete: 'SET NULL',
      },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      result: { type: Sequelize.JSONB, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lease_until: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('import_jobs', ['tenant_id', 'state'], {
      name: 'idx_import_jobs_tenant_state',
    });
    /**
     * Lease lookup pattern: SELECT … FROM import_jobs WHERE state = 'queued' AND (lease_until IS NULL
     * OR lease_until < NOW()) ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1; ditto for retries.
     */
    await queryInterface.addIndex('import_jobs', ['state', 'lease_until', 'created_at'], {
      name: 'idx_import_jobs_drain',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('import_jobs');
  },
};
