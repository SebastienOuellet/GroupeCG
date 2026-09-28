import { DataTypes } from "sequelize";
import { DRIVEWAY_SIZES, DRIVEWAY_SURFACES, LOCATION_SOURCES } from "./serviceAddress.constants.js";

export default (sequelize) => {
  const ServiceAddress = sequelize.define(
    "ServiceAddress",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      ClientId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      CivicNumber: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Street: {
        type: DataTypes.STRING,
        allowNull: false
      },
      City: {
        type: DataTypes.STRING,
        allowNull: false
      },
      PostalCode: {
        type: DataTypes.STRING(7),
        allowNull: false,
        set(value) {
          this.setDataValue("PostalCode", String(value || "").replace(/\s/g, "").toUpperCase());
        }
      },
      /** Identifiant Google du lieu : seule donnée Google stockable indéfiniment (sert à rafraîchir les coordonnées). */
      PlaceId: {
        type: DataTypes.STRING(255),
        set(value) {
          this.setDataValue("PlaceId", value || null);
        }
      },
      // Coordonnées : cache Google daté (LocationUpdatedAt) ou pin corrigé à la main (LocationSource)
      Latitude: {
        type: DataTypes.DECIMAL(9, 6),
        validate: { min: -90, max: 90 }
      },
      Longitude: {
        type: DataTypes.DECIMAL(9, 6),
        validate: { min: -180, max: 180 }
      },
      LocationSource: {
        type: DataTypes.STRING(20),
        validate: { isIn: [LOCATION_SOURCES] }
      },
      LocationUpdatedAt: {
        type: DataTypes.DATE
      },
      DrivewaySurface: {
        type: DataTypes.STRING(20),
        validate: { isIn: [DRIVEWAY_SURFACES] },
        // "" venant d'un formulaire = non précisé
        set(value) {
          this.setDataValue("DrivewaySurface", value || null);
        }
      },
      DrivewaySize: {
        type: DataTypes.STRING(20),
        validate: { isIn: [DRIVEWAY_SIZES] },
        set(value) {
          this.setDataValue("DrivewaySize", value || null);
        }
      },
      Notes: {
        type: DataTypes.TEXT
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: "ServiceAddress",
      tableName: "ServiceAddresses"
    }
  );

  ServiceAddress.associate = (db) => {
    ServiceAddress.belongsTo(db.Client, { foreignKey: "ClientId", as: "Client" });
    ServiceAddress.hasMany(db.Tenant, { foreignKey: "ServiceAddressId", as: "Tenants" });
    ServiceAddress.hasMany(db.Contract, { foreignKey: "ServiceAddressId", as: "Contracts" });
  };

  return ServiceAddress;
};
