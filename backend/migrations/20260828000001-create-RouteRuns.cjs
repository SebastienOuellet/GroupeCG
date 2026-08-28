"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("RouteRuns", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      RouteId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Routes", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      OperatorUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "in_progress"
      },
      StartedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      CompletedAt: {
        type: Sequelize.DATE
      },
      NotificationBatchId: {
        type: Sequelize.INTEGER,
        references: { model: "NotificationBatches", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.addIndex("RouteRuns", ["RouteId", "Status"], { name: "route_runs_route_status_idx" });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("RouteRuns");
  }
};
