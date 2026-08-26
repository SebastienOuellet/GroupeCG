import { DataTypes } from "sequelize";

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
