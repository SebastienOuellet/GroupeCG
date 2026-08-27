"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Invoices", {
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
        onDelete: "RESTRICT"
      },
      InvoiceNumber: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      Amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "draft"
      },
      IssuedAt: {
        type: Sequelize.DATEONLY
      },
      DueDate: {
        type: Sequelize.DATEONLY
      },
      PaidAt: {
        type: Sequelize.DATEONLY
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

    await queryInterface.addIndex("Invoices", ["ContractId"], { name: "invoices_contract_idx" });
    await queryInterface.addIndex("Invoices", ["Status", "DueDate"], { name: "invoices_status_due_date_idx" });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Invoices");
  }
};
