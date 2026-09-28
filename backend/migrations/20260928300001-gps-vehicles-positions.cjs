"use strict";

/**
 * Phase G1 de la géolocalisation (PLAN-GPS-TRACTEURS.md) :
 *  - Vehicles : tracteurs suivis, jeton d'appareil (haché) et dernière position connue.
 *  - Routes.DefaultVehicleId : tracteur proposé au démarrage de la tournée.
 *  - RouteRuns.VehicleId : tracteur confirmé par l'opérateur (null = GPS du téléphone seulement).
 *  - VehiclePositions : positions brutes, seulement pendant une tournée en cours, purgées après N jours.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        "Vehicles",
        {
          Id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
          Name: { type: Sequelize.STRING(100), allowNull: false, unique: true },
          Notes: { type: Sequelize.TEXT, allowNull: true },
          SourceType: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "osmand" },
          DeviceKey: { type: Sequelize.STRING(100), allowNull: true, unique: true },
          DeviceTokenHash: { type: Sequelize.STRING(64), allowNull: true, unique: true },
          DeviceTokenCreatedAt: { type: Sequelize.DATE, allowNull: true },
          LastPositionAt: { type: Sequelize.DATE, allowNull: true },
          LastLatitude: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
          LastLongitude: { type: Sequelize.DECIMAL(9, 6), allowNull: true },
          LastSpeedKmh: { type: Sequelize.DECIMAL(6, 1), allowNull: true },
          LastHeading: { type: Sequelize.DECIMAL(5, 1), allowNull: true },
          LastBatteryPercent: { type: Sequelize.INTEGER, allowNull: true },
          IsActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          createdAt: { allowNull: false, type: Sequelize.DATE },
          updatedAt: { allowNull: false, type: Sequelize.DATE }
        },
        { transaction }
      );

      const vehicleFk = {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Vehicles", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      };
      await queryInterface.addColumn("Routes", "DefaultVehicleId", vehicleFk, { transaction });
      await queryInterface.addColumn("RouteRuns", "VehicleId", vehicleFk, { transaction });

      await queryInterface.createTable(
        "VehiclePositions",
        {
          Id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.BIGINT },
          VehicleId: vehicleFk,
          RouteRunId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: "RouteRuns", key: "Id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          Latitude: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
          Longitude: { type: Sequelize.DECIMAL(9, 6), allowNull: false },
          SpeedKmh: { type: Sequelize.DECIMAL(6, 1), allowNull: true },
          Heading: { type: Sequelize.DECIMAL(5, 1), allowNull: true },
          AccuracyM: { type: Sequelize.DECIMAL(7, 1), allowNull: true },
          Source: { type: Sequelize.STRING(20), allowNull: false },
          RecordedAt: { type: Sequelize.DATE, allowNull: false },
          createdAt: { allowNull: false, type: Sequelize.DATE }
        },
        { transaction }
      );
      await queryInterface.addIndex("VehiclePositions", ["RouteRunId", "RecordedAt"], { name: "vehicle_positions_run_recorded", transaction });
      // Purge quotidienne par date d'enregistrement
      await queryInterface.addIndex("VehiclePositions", ["RecordedAt"], { name: "vehicle_positions_recorded", transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable("VehiclePositions", { transaction });
      await queryInterface.removeColumn("RouteRuns", "VehicleId", { transaction });
      await queryInterface.removeColumn("Routes", "DefaultVehicleId", { transaction });
      await queryInterface.dropTable("Vehicles", { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
