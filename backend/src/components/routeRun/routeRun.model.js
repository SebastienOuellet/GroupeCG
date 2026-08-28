import { DataTypes } from "sequelize";
import { ROUTE_RUN_STATUS } from "./routeRun.constants.js";

export default (sequelize) => {
  const RouteRun = sequelize.define(
    "RouteRun",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      RouteId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      OperatorUserId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ROUTE_RUN_STATUS.IN_PROGRESS
      },
      StartedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      CompletedAt: {
        type: DataTypes.DATE
      },
      NotificationBatchId: {
        type: DataTypes.INTEGER
      }
    },
    {
      sequelize,
      modelName: "RouteRun",
      tableName: "RouteRuns"
    }
  );

  RouteRun.associate = (db) => {
    RouteRun.belongsTo(db.Route, { foreignKey: "RouteId", as: "Route" });
    RouteRun.belongsTo(db.User, { foreignKey: "OperatorUserId", as: "Operator" });
    RouteRun.belongsTo(db.NotificationBatch, { foreignKey: "NotificationBatchId", as: "NotificationBatch" });
    RouteRun.hasMany(db.RouteRunStop, { foreignKey: "RouteRunId", as: "Stops" });
  };

  return RouteRun;
};
