import { DataTypes } from "sequelize";

export const TEMPLATE_TYPES = {
  STORM: "storm",
  ROUTE_START: "route_start",
  RENEWAL: "renewal",
  CUSTOM: "custom"
};

export default (sequelize) => {
  return sequelize.define(
    "NotificationTemplate",
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
      Type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: TEMPLATE_TYPES.CUSTOM
      },
      SmsBody: {
        type: DataTypes.TEXT
      },
      EmailSubject: {
        type: DataTypes.STRING
      },
      EmailBody: {
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
      modelName: "NotificationTemplate",
      tableName: "NotificationTemplates"
    }
  );
};
