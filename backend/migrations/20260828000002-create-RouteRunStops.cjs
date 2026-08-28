"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("RouteRunStops", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      RouteRunId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "RouteRuns", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ContractId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Contracts", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      Status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      DoneAt: {
        type: Sequelize.DATE
      },
      Notes: {
        type: Sequelize.TEXT
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

    await queryInterface.addIndex("RouteRunStops", ["RouteRunId"], { name: "route_run_stops_run_idx" });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("RouteRunStops");
  }
};
