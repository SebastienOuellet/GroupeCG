import { DataTypes } from "sequelize";

/**
 * Position brute d'un tracteur pendant une tournée. Jamais de position hors
 * tournée en cours ; purgée après `positionRetentionDays` (cron quotidien).
 */
export default (sequelize) => {
  const VehiclePosition = sequelize.define(
    "VehiclePosition",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.BIGINT
      },
      VehicleId: {
        type: DataTypes.INTEGER
      },
      RouteRunId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Latitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
      },
      Longitude: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: false
      },
      SpeedKmh: {
        type: DataTypes.DECIMAL(6, 1)
      },
      Heading: {
        type: DataTypes.DECIMAL(5, 1)
      },
      AccuracyM: {
        type: DataTypes.DECIMAL(7, 1)
      },
      Source: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      /** Heure de l'appareil (une position peut arriver en retard après une zone morte). */
      RecordedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "VehiclePosition",
      tableName: "VehiclePositions",
      updatedAt: false
    }
  );

  VehiclePosition.associate = (db) => {
    VehiclePosition.belongsTo(db.Vehicle, { foreignKey: "VehicleId", as: "Vehicle" });
    VehiclePosition.belongsTo(db.RouteRun, { foreignKey: "RouteRunId", as: "RouteRun" });
  };

  return VehiclePosition;
};
