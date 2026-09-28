import { DataTypes } from "sequelize";
import { VEHICLE_SOURCE } from "./vehicle.constants.js";

export default (sequelize) => {
  const Vehicle = sequelize.define(
    "Vehicle",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      Notes: {
        type: DataTypes.TEXT
      },
      SourceType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: VEHICLE_SOURCE.OSMAND
      },
      /** Identifiant externe (VIN FieldOps en G6). Inutile pour OsmAnd : le jeton identifie l'appareil. */
      DeviceKey: {
        type: DataTypes.STRING(100)
      },
      /** SHA-256 du jeton d'appareil. Le jeton lui-même n'est montré qu'une fois, à la génération. */
      DeviceTokenHash: {
        type: DataTypes.STRING(64)
      },
      DeviceTokenCreatedAt: {
        type: DataTypes.DATE
      },
      /** Dernière position reçue pendant une tournée (liste des véhicules, « dernier signal il y a… »). */
      LastPositionAt: {
        type: DataTypes.DATE
      },
      LastLatitude: {
        type: DataTypes.DECIMAL(9, 6)
      },
      LastLongitude: {
        type: DataTypes.DECIMAL(9, 6)
      },
      LastSpeedKmh: {
        type: DataTypes.DECIMAL(6, 1)
      },
      LastHeading: {
        type: DataTypes.DECIMAL(5, 1)
      },
      LastBatteryPercent: {
        type: DataTypes.INTEGER
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: "Vehicle",
      tableName: "Vehicles",
      // Le hash du jeton ne sort jamais de l'API
      // (la recherche par jeton filtre sur la colonne sans avoir à la lire)
      defaultScope: { attributes: { exclude: ["DeviceTokenHash"] } }
    }
  );

  Vehicle.associate = (db) => {
    Vehicle.hasMany(db.Route, { foreignKey: "DefaultVehicleId", as: "DefaultForRoutes" });
    Vehicle.hasMany(db.RouteRun, { foreignKey: "VehicleId", as: "Runs" });
  };

  return Vehicle;
};
