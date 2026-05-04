'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'resolution', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('tasks', 'due_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('tasks', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
    await queryInterface.addIndex('activity_logs', ['tenant_id', 'created_at'], {
      name: 'idx_activity_logs_tenant_created',
    });
    await queryInterface.addIndex('activity_logs', ['task_id', 'created_at'], {
      name: 'idx_activity_logs_task_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('activity_logs', 'idx_activity_logs_task_created');
    await queryInterface.removeIndex('activity_logs', 'idx_activity_logs_tenant_created');
    await queryInterface.removeColumn('tasks', 'metadata');
    await queryInterface.removeColumn('tasks', 'due_date');
    await queryInterface.removeColumn('tasks', 'resolution');
  },
};
