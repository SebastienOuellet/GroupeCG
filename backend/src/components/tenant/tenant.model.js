import { DataTypes } from "sequelize";

export const CONSENT_SOURCES = {
  ADMIN: "admin",
  SELF_SERVICE: "self_service",
  IMPORT: "import"
};

export default (sequelize) => {
  const Tenant = sequelize.define(
    "Tenant",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      ServiceAddressId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      FirstName: {
        type: DataTypes.STRING
      },
      LastName: {
        type: DataTypes.STRING
      },
      Phone: {
        type: DataTypes.STRING
      },
      Email: {
        type: DataTypes.STRING,
        set(value) {
          this.setDataValue("Email", value ? String(value).trim().toLowerCase() : null);
        }
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
      ConsentSource: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: CONSENT_SOURCES.ADMIN
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: "Tenant",
      tableName: "Tenants"
    }
  );

  Tenant.associate = (db) => {
    Tenant.belongsTo(db.ServiceAddress, { foreignKey: "ServiceAddressId", as: "ServiceAddress" });
  };

  return Tenant;
};
