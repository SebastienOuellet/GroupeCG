import { DataTypes } from "sequelize";
import { CONTRACT_STATUS } from "./contract.constants.js";

export default (sequelize) => {
  const Contract = sequelize.define(
    "Contract",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Reference: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      ContractNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
      },
      ClientId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ServiceAddressId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      RouteId: {
        type: DataTypes.INTEGER
      },
      SeasonStartYear: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      StartDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      EndDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      Price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: CONTRACT_STATUS.DRAFT
      },
      RenewedFromContractId: {
        type: DataTypes.INTEGER
      },
      RenewalNoticeSentAt: {
        type: DataTypes.DATE
      },
      Notes: {
        type: DataTypes.TEXT
      }
    },
    {
      sequelize,
      modelName: "Contract",
      tableName: "Contracts"
    }
  );

  Contract.associate = (db) => {
    Contract.belongsTo(db.Client, { foreignKey: "ClientId", as: "Client" });
    Contract.belongsTo(db.ServiceAddress, { foreignKey: "ServiceAddressId", as: "ServiceAddress" });
    Contract.belongsTo(db.Route, { foreignKey: "RouteId", as: "Route" });
    Contract.belongsTo(db.Contract, { foreignKey: "RenewedFromContractId", as: "RenewedFrom" });
  };

  return Contract;
};
