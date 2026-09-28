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
      /** Ordre figé au démarrage : réordonner la route pendant une tempête ne change pas la tournée en cours. */
      Sequence: {
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
      /** manual / auto_gps (STOP_DONE_SOURCE). */
      DoneSource: {
        type: DataTypes.STRING(20)
      },
      /** Détectés par GPS (géorepérage) ; gardés quand l'opérateur coche à la main. */
      ArrivedAt: {
        type: DataTypes.DATE
      },
      DepartedAt: {
        type: DataTypes.DATE
      },
      /** Durée de déneigement réelle (départ − arrivée). Sert à calibrer les durées (G4). */
      ServiceSeconds: {
        type: DataTypes.INTEGER
      },
      /** Trajet réel depuis le départ de l'arrêt précédent (ou le début de la tournée). */
      TravelSeconds: {
        type: DataTypes.INTEGER
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
