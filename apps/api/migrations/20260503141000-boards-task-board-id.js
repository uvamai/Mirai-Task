'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('boards', {
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
      name: { type: Sequelize.STRING(255), allowNull: false },
      template_key: { type: Sequelize.STRING(64), allowNull: true },
      settings: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      position: { type: Sequelize.DOUBLE, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('boards', ['tenant_id', 'project_id'], { name: 'idx_boards_tenant_project' });

    await queryInterface.addColumn('tasks', 'board_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'boards', key: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('tasks', ['board_id'], { name: 'idx_tasks_board' });

    await queryInterface.sequelize.query(`
      WITH ins AS (
        INSERT INTO boards (id, tenant_id, project_id, name, template_key, settings, position, created_at, updated_at)
        SELECT gen_random_uuid(), p.tenant_id, p.id, p.name || ' — Main', 'default', '{}'::jsonb, 0, now(), now()
        FROM projects p
        RETURNING id, project_id
      )
      UPDATE tasks t SET board_id = ins.id FROM ins WHERE t.project_id = ins.project_id;
    `);

    await queryInterface.changeColumn('tasks', 'board_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'boards', key: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tasks', 'board_id');
    await queryInterface.dropTable('boards');
  },
};
