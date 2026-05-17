'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add fields to tasks
    await queryInterface.addColumn('tasks', 'type', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'task',
    });
    await queryInterface.addColumn('tasks', 'custom_fields', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    // 2. Add fields to projects
    await queryInterface.addColumn('projects', 'prd_content', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('projects', 'timeline', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    // 3. Create tenant_integrations table
    await queryInterface.createTable('tenant_integrations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      provider: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      encrypted_config: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'active',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('tenant_integrations', ['tenant_id', 'provider'], {
      unique: true,
      name: 'tenant_integrations_tenant_id_provider_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tenant_integrations');
    await queryInterface.removeColumn('projects', 'timeline');
    await queryInterface.removeColumn('projects', 'prd_content');
    await queryInterface.removeColumn('tasks', 'custom_fields');
    await queryInterface.removeColumn('tasks', 'type');
  },
};
