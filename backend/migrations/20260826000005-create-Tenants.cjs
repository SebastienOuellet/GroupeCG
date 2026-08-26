"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Tenants", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ServiceAddressId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ServiceAddresses", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      FirstName: {
        type: Sequelize.STRING
      },
      LastName: {
        type: Sequelize.STRING
      },
      Phone: {
        type: Sequelize.STRING
      },
      Email: {
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
      ConsentSource: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "admin"
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
    await queryInterface.dropTable("Tenants");
  }
};
