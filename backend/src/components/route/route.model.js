import { DataTypes } from "sequelize";
import { ROUTE_SEQUENCE_SOURCES } from "./route.constants.js";

export default (sequelize) => {
  const Route = sequelize.define(
    "Route",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      Description: {
        type: DataTypes.TEXT
      },
      OperatorUserId: {
        type: DataTypes.INTEGER
      },
      /** Tracteur proposé au démarrage d'une tournée (l'opérateur peut en choisir un autre). */
      DefaultVehicleId: {
        type: DataTypes.INTEGER
      },
      SortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      /** Point d'attache du véhicule { label, placeId, latitude, longitude, locationUpdatedAt }. null = dépôt (Paramètres › Routes). Départ et retour. */
      BaseLocation: {
        type: DataTypes.JSONB
      },
      /** Traçabilité de l'ordre de passage en vigueur. */
      SequenceSource: {
        type: DataTypes.STRING(20),
        validate: { isIn: [ROUTE_SEQUENCE_SOURCES] }
      },
      SequenceUpdatedAt: {
        type: DataTypes.DATE
      },
      SequenceUpdatedByUserId: {
        type: DataTypes.INTEGER
      }
    },
    {
      sequelize,
      modelName: "Route",
      tableName: "Routes"
    }
  );

  Route.associate = (db) => {
    Route.belongsTo(db.User, { foreignKey: "OperatorUserId", as: "Operator" });
    Route.belongsTo(db.User, { foreignKey: "SequenceUpdatedByUserId", as: "SequenceUpdatedBy" });
    Route.belongsTo(db.Vehicle, { foreignKey: "DefaultVehicleId", as: "DefaultVehicle" });
    Route.hasMany(db.Contract, { foreignKey: "RouteId", as: "Contracts" });
    Route.hasMany(db.RouteRun, { foreignKey: "RouteId", as: "Runs" });
  };

  return Route;
};
