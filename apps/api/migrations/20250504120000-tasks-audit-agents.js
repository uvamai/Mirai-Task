'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employee_profiles', {
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
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      phone: { type: Sequelize.STRING(64), allowNull: true },
      department: { type: Sequelize.STRING(255), allowNull: true },
      manager_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      avatar_url: { type: Sequelize.STRING(2048), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('employee_profiles', {
      fields: ['tenant_id', 'user_id'],
      type: 'unique',
      name: 'employee_profiles_tenant_user_unique',
    });
    await queryInterface.addIndex('employee_profiles', ['tenant_id'], { name: 'idx_employee_profiles_tenant' });

    await queryInterface.createTable('agents', {
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
      type: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'orchestrator' },
      api_key_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      permissions: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('agents', ['tenant_id'], { name: 'idx_agents_tenant' });

    await queryInterface.createTable('tasks', {
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
      key: { type: Sequelize.STRING(64), allowNull: false },
      title: { type: Sequelize.STRING(512), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      priority: { type: Sequelize.STRING(8), allowNull: false },
      status: { type: Sequelize.STRING(64), allowNull: false },
      assignee_type: { type: Sequelize.STRING(16), allowNull: true },
      assignee_id: { type: Sequelize.STRING(64), allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      sla_deadline: { type: Sequelize.DATE, allowNull: true },
      sla_state: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      dependencies: { type: Sequelize.ARRAY(Sequelize.UUID), allowNull: false, defaultValue: [] },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
      estimate: { type: Sequelize.INTEGER, allowNull: true },
      position: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('tasks', {
      fields: ['tenant_id', 'key'],
      type: 'unique',
      name: 'tasks_tenant_key_unique',
    });
    await queryInterface.addIndex('tasks', ['tenant_id', 'project_id'], { name: 'idx_tasks_tenant_project' });
    await queryInterface.addIndex('tasks', ['tenant_id', 'status'], { name: 'idx_tasks_tenant_status' });

    await queryInterface.createTable('activity_logs', {
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
      task_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'SET NULL',
      },
      actor_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      actor_agent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'agents', key: 'id' },
        onDelete: 'SET NULL',
      },
      actor_type: { type: Sequelize.STRING(16), allowNull: false },
      action: { type: Sequelize.STRING(128), allowNull: false },
      entity_type: { type: Sequelize.STRING(64), allowNull: true },
      entity_id: { type: Sequelize.UUID, allowNull: true },
      before_json: { type: Sequelize.JSONB, allowNull: true },
      after_json: { type: Sequelize.JSONB, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: true },
      request_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('activity_logs', ['tenant_id', 'created_at'], { name: 'idx_activity_tenant_created' });

    await queryInterface.createTable('reassignments', {
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
      task_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      from_assignee_type: { type: Sequelize.STRING(16), allowNull: true },
      from_assignee_id: { type: Sequelize.STRING(64), allowNull: true },
      to_assignee_type: { type: Sequelize.STRING(16), allowNull: true },
      to_assignee_id: { type: Sequelize.STRING(64), allowNull: true },
      reason: { type: Sequelize.TEXT, allowNull: false },
      actor_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      is_automatic: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('reassignments', ['task_id'], { name: 'idx_reassignments_task' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reassignments');
    await queryInterface.dropTable('activity_logs');
    await queryInterface.dropTable('tasks');
    await queryInterface.dropTable('agents');
    await queryInterface.dropTable('employee_profiles');
  },
};
