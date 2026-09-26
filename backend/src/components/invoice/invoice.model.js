import { DataTypes } from "sequelize";
import { INVOICE_STATUS, INVOICE_TYPE } from "./invoice.constants.js";

export default (sequelize) => {
  const Invoice = sequelize.define(
    "Invoice",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: INVOICE_TYPE.CONTRACT
      },
      ClientId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      /** Null pour une facture de service (hors contrat). */
      ContractId: {
        type: DataTypes.INTEGER
      },
      InvoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      Subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      TpsAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      TvqAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      /** Total taxes incluses. */
      Amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: INVOICE_STATUS.DRAFT
      },
      IssuedAt: {
        type: DataTypes.DATEONLY
      },
      DueDate: {
        type: DataTypes.DATEONLY
      },
      PaidAt: {
        type: DataTypes.DATEONLY
      },
      CancelledAt: {
        type: DataTypes.DATEONLY
      },
      /** Facture annulée que celle-ci remplace (modification après envoi). */
      ReplacesInvoiceId: {
        type: DataTypes.INTEGER
      },
      Notes: {
        type: DataTypes.TEXT
      }
    },
    {
      sequelize,
      modelName: "Invoice",
      tableName: "Invoices"
    }
  );

  Invoice.associate = (db) => {
    Invoice.belongsTo(db.Contract, { foreignKey: "ContractId", as: "Contract" });
    Invoice.belongsTo(db.Client, { foreignKey: "ClientId", as: "Client" });
    Invoice.hasMany(db.InvoiceLine, { foreignKey: "InvoiceId", as: "Lines" });
    Invoice.belongsTo(db.Invoice, { foreignKey: "ReplacesInvoiceId", as: "ReplacesInvoice" });
  };

  return Invoice;
};
