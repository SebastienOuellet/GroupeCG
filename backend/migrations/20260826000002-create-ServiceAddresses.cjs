"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ServiceAddresses", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ClientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Clients", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      CivicNumber: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Street: {
        type: Sequelize.STRING,
        allowNull: false
      },
      City: {
        type: Sequelize.STRING,
        allowNull: false
      },
      PostalCode: {
        type: Sequelize.STRING(7),
        allowNull: false
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
    await queryInterface.dropTable("ServiceAddresses");
  }
};
