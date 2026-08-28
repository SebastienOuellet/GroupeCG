import { DataTypes } from "sequelize";
import { ROUTE_RUN_STOP_STATUS } from "./routeRun.constants.js";

export default (sequelize) => {
  const RouteRunStop = sequelize.define(
    "RouteRunStop",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      RouteRunId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ContractId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ROUTE_RUN_STOP_STATUS.PENDING
      },
      DoneAt: {
        type: DataTypes.DATE
      },
      Notes: {
        type: DataTypes.TEXT
      }
    },
    {
      sequelize,
      modelName: "RouteRunStop",
      tableName: "RouteRunStops"
    }
  );

  RouteRunStop.associate = (db) => {
    RouteRunStop.belongsTo(db.RouteRun, { foreignKey: "RouteRunId", as: "RouteRun" });
    RouteRunStop.belongsTo(db.Contract, { foreignKey: "ContractId", as: "Contract" });
  };

  return RouteRunStop;
};
