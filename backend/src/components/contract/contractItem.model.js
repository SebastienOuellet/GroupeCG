import { DataTypes } from "sequelize";

/** Ligne d'un contrat : ce qui est déneigé (entrée, balcon, toiture...) et son prix avant taxes. */
export default (sequelize) => {
  const ContractItem = sequelize.define(
    "ContractItem",
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
      Description: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      Quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1
      },
      UnitPrice: {
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
      modelName: "ContractItem",
      tableName: "ContractItems"
    }
  );

  ContractItem.associate = (db) => {
    ContractItem.belongsTo(db.Contract, { foreignKey: "ContractId", as: "Contract" });
  };

  return ContractItem;
};
