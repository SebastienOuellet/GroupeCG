import { DataTypes } from "sequelize";
import { BATCH_STATUS, BATCH_TYPES } from "./notification.constants.js";

export default (sequelize) => {
  const NotificationBatch = sequelize.define(
    "NotificationBatch",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: BATCH_TYPES.MANUAL
      },
      TargetType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      TargetId: {
        type: DataTypes.INTEGER
      },
      TemplateId: {
        type: DataTypes.INTEGER
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
      UseSms: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      UseEmail: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      Status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: BATCH_STATUS.PENDING
      },
      CreatedByUserId: {
        type: DataTypes.INTEGER
      },
      TotalCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      SentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      FailedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      SkippedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      CompletedAt: {
        type: DataTypes.DATE
      }
    },
    {
      sequelize,
      modelName: "NotificationBatch",
      tableName: "NotificationBatches"
    }
  );

  NotificationBatch.associate = (db) => {
    NotificationBatch.belongsTo(db.User, { foreignKey: "CreatedByUserId", as: "CreatedBy" });
    NotificationBatch.belongsTo(db.NotificationTemplate, { foreignKey: "TemplateId", as: "Template" });
    NotificationBatch.hasMany(db.NotificationDelivery, { foreignKey: "BatchId", as: "Deliveries" });
  };

  return NotificationBatch;
};
