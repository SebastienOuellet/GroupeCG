"use strict";

/**
 * Lignes d'un contrat (entrée, balcon, toiture...). Contracts.Price devient la
 * somme des lignes (sous-total avant taxes), recalculée par le service.
 * Chaque contrat existant reçoit une ligne unique reprenant son prix.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ContractItems", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ContractId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Contracts", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      Description: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      Quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1
      },
      UnitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      SortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex("ContractItems", ["ContractId"], { name: "contract_items_contract_idx" });

    await queryInterface.sequelize.query(`
      INSERT INTO "ContractItems" ("ContractId", "Description", "Quantity", "UnitPrice", "SortOrder", "createdAt", "updatedAt")
      SELECT "Id", 'Déneigement saisonnier', 1, "Price", 0, NOW(), NOW() FROM "Contracts"
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ContractItems");
  }
};
