import { DataTypes } from "sequelize";
import { DELIVERY_STATUS } from "./notification.constants.js";

export default (sequelize) => {
  const NotificationDelivery = sequelize.define(
    "NotificationDelivery",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      BatchId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Channel: {
        type: DataTypes.STRING,
        allowNull: false
      },
      RecipientType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      RecipientId: {
        type: DataTypes.INTEGER
      },
      ContactAddress: {
        type: DataTypes.STRING,
        allowNull: false
      },
      ContractId: {
        type: DataTypes.INTEGER
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: DELIVERY_STATUS.QUEUED
      },
      Attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      NextAttemptAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      LastError: {
        type: DataTypes.TEXT
      },
      ProviderMessageId: {
        type: DataTypes.STRING
      },
      SentAt: {
        type: DataTypes.DATE
      }
    },
    {
      sequelize,
      modelName: "NotificationDelivery",
      tableName: "NotificationDeliveries"
    }
  );

  NotificationDelivery.associate = (db) => {
    NotificationDelivery.belongsTo(db.NotificationBatch, { foreignKey: "BatchId", as: "Batch" });
    NotificationDelivery.belongsTo(db.Contract, { foreignKey: "ContractId", as: "Contract" });
  };

  return NotificationDelivery;
};
