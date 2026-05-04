'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'parent_task_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'tasks', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('tasks', ['parent_task_id'], { name: 'idx_tasks_parent_task_id' });
    await queryInterface.addIndex('tasks', ['tenant_id', 'parent_task_id'], { name: 'idx_tasks_tenant_parent' });

    await queryInterface.addColumn('tenant_memberships', 'preferences', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addColumn('task_comments', 'mentions', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('task_comments', 'mentions');
    await queryInterface.removeColumn('tenant_memberships', 'preferences');
    await queryInterface.removeIndex('tasks', 'idx_tasks_tenant_parent');
    await queryInterface.removeIndex('tasks', 'idx_tasks_parent_task_id');
    await queryInterface.removeColumn('tasks', 'parent_task_id');
  },
};
