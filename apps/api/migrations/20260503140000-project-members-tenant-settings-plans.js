'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tenants', 'settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addColumn('subscription_plans', 'max_boards_per_project', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'null = unlimited',
    });
    await queryInterface.sequelize.query(`
      UPDATE subscription_plans SET max_boards_per_project = 3 WHERE code = 'starter';
      UPDATE subscription_plans SET max_boards_per_project = 25 WHERE code = 'pro';
      UPDATE subscription_plans SET max_boards_per_project = NULL WHERE code = 'enterprise';
    `);

    await queryInterface.createTable('project_members', {
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
      role: { type: Sequelize.STRING(32), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addConstraint('project_members', {
      fields: ['project_id', 'user_id'],
      type: 'unique',
      name: 'project_members_project_user_unique',
    });
    await queryInterface.addIndex('project_members', ['tenant_id', 'user_id'], { name: 'idx_project_members_tenant_user' });
    await queryInterface.addIndex('project_members', ['project_id'], { name: 'idx_project_members_project' });

    // Backfill: every ADMIN/MANAGER in a tenant gets LEAD on each project in that tenant
    await queryInterface.sequelize.query(`
      INSERT INTO project_members (id, tenant_id, project_id, user_id, role, created_at, updated_at)
      SELECT gen_random_uuid(), p.tenant_id, p.id, tm.user_id, 'LEAD', now(), now()
      FROM projects p
      INNER JOIN tenant_memberships tm ON tm.tenant_id = p.tenant_id AND tm.role IN ('ADMIN', 'MANAGER')
      ON CONFLICT (project_id, user_id) DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_members');
    await queryInterface.removeColumn('subscription_plans', 'max_boards_per_project');
    await queryInterface.removeColumn('tenants', 'settings');
  },
};
