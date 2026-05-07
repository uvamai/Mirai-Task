'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_relations', {
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
      from_task_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      to_task_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tasks', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'related' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('task_relations', ['tenant_id', 'project_id', 'from_task_id'], {
      name: 'idx_task_relations_from',
    });
    await queryInterface.addIndex('task_relations', ['tenant_id', 'project_id', 'to_task_id'], {
      name: 'idx_task_relations_to',
    });
    await queryInterface.addIndex('task_relations', ['tenant_id', 'project_id', 'type'], {
      name: 'idx_task_relations_type',
    });

    // Enforce one relation per pair (assumes normalized ordering in application/service layer).
    await queryInterface.addConstraint('task_relations', {
      fields: ['tenant_id', 'project_id', 'type', 'from_task_id', 'to_task_id'],
      type: 'unique',
      name: 'task_relations_pair_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('task_relations');
  },
};

