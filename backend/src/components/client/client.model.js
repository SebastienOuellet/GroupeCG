import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Client = sequelize.define(
    "Client",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      ClientNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
      },
      FirstName: {
        type: DataTypes.STRING
      },
      LastName: {
        type: DataTypes.STRING
      },
      CompanyName: {
        type: DataTypes.STRING
      },
      Email: {
        type: DataTypes.STRING
      },
      Phone: {
        type: DataTypes.STRING
      },
      SmsConsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      EmailConsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      VoiceConsent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
      modelName: "Client",
      tableName: "Clients"
    }
  );

  Client.associate = (db) => {
    Client.hasMany(db.ServiceAddress, { foreignKey: "ClientId", as: "ServiceAddresses" });
    Client.hasMany(db.Contract, { foreignKey: "ClientId", as: "Contracts" });
  };

  return Client;
};
