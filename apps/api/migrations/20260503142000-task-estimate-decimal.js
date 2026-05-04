'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tasks', 'estimate', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE tasks SET estimate = ROUND(estimate)::int WHERE estimate IS NOT NULL;
    `);
    await queryInterface.changeColumn('tasks', 'estimate', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
};
