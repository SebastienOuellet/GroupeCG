"use strict";

/**
 * Factures : lignes figées (copie des lignes du contrat au moment de la
 * facturation), taxes TPS/TVQ figées, traçabilité des annulations/remplacements.
 * Invoices.Amount reste le TOTAL taxes incluses.
 *
 * Factures existantes : saisies avant la gestion des taxes → Subtotal = Amount,
 * taxes à 0, une ligne unique reprenant le montant.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("InvoiceLines", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      InvoiceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Invoices", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      Description: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      Quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      UnitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      LineTotal: {
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
    await queryInterface.addIndex("InvoiceLines", ["InvoiceId"], { name: "invoice_lines_invoice_idx" });

    await queryInterface.addColumn("Invoices", "Subtotal", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("Invoices", "TpsAmount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("Invoices", "TvqAmount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("Invoices", "CancelledAt", {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await queryInterface.addColumn("Invoices", "ReplacesInvoiceId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "Invoices", key: "Id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addIndex("Invoices", ["IssuedAt"], { name: "invoices_issued_at_idx" });

    await queryInterface.sequelize.query(`UPDATE "Invoices" SET "Subtotal" = "Amount"`);
    await queryInterface.sequelize.query(`
      INSERT INTO "InvoiceLines" ("InvoiceId", "Description", "Quantity", "UnitPrice", "LineTotal", "SortOrder", "createdAt", "updatedAt")
      SELECT "Id", 'Déneigement saisonnier', 1, "Amount", "Amount", 0, NOW(), NOW() FROM "Invoices"
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("Invoices", "invoices_issued_at_idx");
    await queryInterface.removeColumn("Invoices", "ReplacesInvoiceId");
    await queryInterface.removeColumn("Invoices", "CancelledAt");
    await queryInterface.removeColumn("Invoices", "TvqAmount");
    await queryInterface.removeColumn("Invoices", "TpsAmount");
    await queryInterface.removeColumn("Invoices", "Subtotal");
    await queryInterface.dropTable("InvoiceLines");
  }
};
