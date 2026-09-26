"use strict";

/**
 * Factures de service (travaux hors contrat) : une facture appartient
 * désormais à un CLIENT, et au contrat seulement quand elle en découle.
 *  - ClientId : renseigné depuis le contrat pour les factures existantes
 *  - ContractId : nullable (null = facture de service)
 *  - Type : "contract" | "service" (voir invoice.constants.js)
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Invoices", "Type", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "contract"
    });
    await queryInterface.addColumn("Invoices", "ClientId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "Clients", key: "Id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });
    await queryInterface.sequelize.query(`
      UPDATE "Invoices" i SET "ClientId" = c."ClientId" FROM "Contracts" c WHERE c."Id" = i."ContractId"
    `);
    await queryInterface.changeColumn("Invoices", "ClientId", {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    await queryInterface.changeColumn("Invoices", "ContractId", {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addIndex("Invoices", ["ClientId"], { name: "invoices_client_idx" });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DELETE FROM "Invoices" WHERE "ContractId" IS NULL`);
    await queryInterface.changeColumn("Invoices", "ContractId", {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    await queryInterface.removeIndex("Invoices", "invoices_client_idx");
    await queryInterface.removeColumn("Invoices", "ClientId");
    await queryInterface.removeColumn("Invoices", "Type");
  }
};
