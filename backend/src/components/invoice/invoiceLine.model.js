import { DataTypes } from "sequelize";

/**
 * Ligne de facture : COPIE figée d'une ligne de contrat au moment de la
 * facturation. Modifier le contrat ensuite ne touche pas les factures émises.
 */
export default (sequelize) => {
  const InvoiceLine = sequelize.define(
    "InvoiceLine",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      InvoiceId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Description: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      Quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      UnitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      LineTotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      SortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      sequelize,
      modelName: "InvoiceLine",
      tableName: "InvoiceLines"
    }
  );

  InvoiceLine.associate = (db) => {
    InvoiceLine.belongsTo(db.Invoice, { foreignKey: "InvoiceId", as: "Invoice" });
  };

  return InvoiceLine;
};
