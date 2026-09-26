import { DataTypes } from "sequelize";
import { DRIVEWAY_SURFACES } from "./serviceAddress.constants.js";

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
      // Coordonnées Google (autocomplete) : Street View de l'entrée et futur tri de route
      Latitude: {
        type: DataTypes.DECIMAL(9, 6),
        validate: { min: -90, max: 90 }
      },
      Longitude: {
        type: DataTypes.DECIMAL(9, 6),
        validate: { min: -180, max: 180 }
      },
      DrivewaySurface: {
        type: DataTypes.STRING(20),
        validate: { isIn: [DRIVEWAY_SURFACES] },
        // "" venant d'un formulaire = non précisé
        set(value) {
          this.setDataValue("DrivewaySurface", value || null);
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
