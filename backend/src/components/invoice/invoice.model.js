import { DataTypes } from "sequelize";
import { INVOICE_STATUS } from "./invoice.constants.js";

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
      ContractId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      InvoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
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
  };

  return Invoice;
};
