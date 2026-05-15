'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add start_date to tasks
    await queryInterface.addColumn('tasks', 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    // 2. Create documents table
    await queryInterface.createTable('documents', {
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
      title: { type: Sequelize.STRING(512), allowNull: false },
      content: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // 3. Create forms table
    await queryInterface.createTable('forms', {
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
      board_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'boards', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      fields: { type: Sequelize.JSONB, allowNull: false, defaultValue: '[]' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // Indexes
    await queryInterface.addIndex('documents', ['tenant_id', 'project_id']);
    await queryInterface.addIndex('forms', ['tenant_id', 'project_id', 'board_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('forms');
    await queryInterface.dropTable('documents');
    await queryInterface.removeColumn('tasks', 'start_date');
  },
};
