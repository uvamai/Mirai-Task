'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenant_invitations', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      email: { type: Sequelize.STRING(320), allowNull: false },
      membership_role: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'EMPLOYEE' },
      token_hash: { type: Sequelize.STRING(128), allowNull: false },
      invited_by_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      accepted_at: { type: Sequelize.DATE, allowNull: true },
      accepted_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('tenant_invitations', ['tenant_id', 'email'], {
      name: 'idx_tenant_invitations_tenant_email',
    });
    await queryInterface.addIndex('tenant_invitations', ['token_hash'], { name: 'idx_tenant_invitations_token_hash' });

    await queryInterface.createTable('task_comments', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      tenant_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tenants', key: 'id' }, onDelete: 'CASCADE' },
      task_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'tasks', key: 'id' }, onDelete: 'CASCADE' },
      author_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      body: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('task_comments', ['task_id', 'created_at'], { name: 'idx_task_comments_task_created' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('task_comments');
    await queryInterface.dropTable('tenant_invitations');
  },
};
