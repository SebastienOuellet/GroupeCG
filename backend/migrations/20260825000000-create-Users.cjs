"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      FirebaseUid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      Email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Name: {
        type: Sequelize.STRING
      },
      Role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "user"
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Users");
  }
};
