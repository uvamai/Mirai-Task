'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_sales_leads', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      name: { type: Sequelize.STRING(200), allowNull: false },
      work_email: { type: Sequelize.STRING(320), allowNull: false },
      company: { type: Sequelize.STRING(255), allowNull: false },
      team_size: { type: Sequelize.STRING(32), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      source: { type: Sequelize.STRING(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('contact_sales_leads', ['created_at'], {
      name: 'idx_contact_sales_leads_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_sales_leads');
  },
};
