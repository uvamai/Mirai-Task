'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_login_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addIndex('users', ['is_login_active'], {
      name: 'idx_users_login_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'idx_users_login_active');
    await queryInterface.removeColumn('users', 'is_login_active');
  },
};
