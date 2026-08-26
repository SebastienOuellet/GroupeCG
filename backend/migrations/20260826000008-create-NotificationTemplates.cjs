"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("NotificationTemplates", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      Type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "custom"
      },
      SmsBody: {
        type: Sequelize.TEXT
      },
      EmailSubject: {
        type: Sequelize.STRING
      },
      EmailBody: {
        type: Sequelize.TEXT
      },
      IsActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
    await queryInterface.dropTable("NotificationTemplates");
  }
};
