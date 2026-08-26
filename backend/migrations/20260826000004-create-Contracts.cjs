"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Contracts", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Reference: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      ContractNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      ClientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Clients", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      ServiceAddressId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "ServiceAddresses", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      RouteId: {
        type: Sequelize.INTEGER,
        references: { model: "Routes", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      SeasonStartYear: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      StartDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      EndDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      Price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "draft"
      },
      RenewedFromContractId: {
        type: Sequelize.INTEGER,
        references: { model: "Contracts", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      RenewalNoticeSentAt: {
        type: Sequelize.DATE
      },
      Notes: {
        type: Sequelize.TEXT
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

    await queryInterface.addIndex("Contracts", ["ServiceAddressId", "SeasonStartYear"], {
      unique: true,
      name: "contracts_service_address_season_unique"
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Contracts");
  }
};
