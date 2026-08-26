"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("NotificationDeliveries", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      BatchId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "NotificationBatches", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      Channel: {
        type: Sequelize.STRING,
        allowNull: false
      },
      RecipientType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      RecipientId: {
        type: Sequelize.INTEGER
      },
      ContactAddress: {
        type: Sequelize.STRING,
        allowNull: false
      },
      ContractId: {
        type: Sequelize.INTEGER,
        references: { model: "Contracts", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "queued"
      },
      Attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      NextAttemptAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      LastError: {
        type: Sequelize.TEXT
      },
      ProviderMessageId: {
        type: Sequelize.STRING
      },
      SentAt: {
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

    await queryInterface.addIndex("NotificationDeliveries", ["Status", "NextAttemptAt"], {
      name: "notification_deliveries_status_next_attempt_idx"
    });
    await queryInterface.addIndex("NotificationDeliveries", ["BatchId"], {
      name: "notification_deliveries_batch_idx"
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("NotificationDeliveries");
  }
};
