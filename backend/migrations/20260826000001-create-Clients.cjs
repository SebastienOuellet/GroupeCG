"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Clients", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ClientNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      FirstName: {
        type: Sequelize.STRING
      },
      LastName: {
        type: Sequelize.STRING
      },
      CompanyName: {
        type: Sequelize.STRING
      },
      Email: {
        type: Sequelize.STRING
      },
      Phone: {
        type: Sequelize.STRING
      },
      SmsConsent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      EmailConsent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      VoiceConsent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      Notes: {
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
    await queryInterface.dropTable("Clients");
  }
};
