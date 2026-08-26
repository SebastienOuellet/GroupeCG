"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("NotificationBatches", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "manual"
      },
      TargetType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      TargetId: {
        type: Sequelize.INTEGER
      },
      TemplateId: {
        type: Sequelize.INTEGER,
        references: { model: "NotificationTemplates", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      SmsBody: {
        type: Sequelize.TEXT
      },
      EmailSubject: {
        type: Sequelize.STRING
      },
      EmailBody: {
        type: Sequelize.TEXT
      },
      UseSms: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      UseEmail: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      CreatedByUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      TotalCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      SentCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      FailedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      SkippedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      CompletedAt: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("NotificationBatches");
  }
};
