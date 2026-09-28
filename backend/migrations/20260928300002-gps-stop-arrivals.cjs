"use strict";

/**
 * Phase G2 de la géolocalisation (PLAN-GPS-TRACTEURS.md) : arrivées et départs détectés par GPS.
 *  - RouteRunStops : ArrivedAt, DepartedAt, ServiceSeconds (déneigement), TravelSeconds (trajet depuis
 *    l'arrêt précédent), DoneSource (manual / auto_gps). Données dérivées CONSERVÉES : elles servent à
 *    calibrer les durées (G4) et ne contiennent aucune trace GPS.
 *  - RouteRuns.GeofenceState : état de la détection entre deux envois de positions (arrêt en cours, etc.).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("RouteRunStops", "ArrivedAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.addColumn("RouteRunStops", "DepartedAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.addColumn("RouteRunStops", "ServiceSeconds", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn("RouteRunStops", "TravelSeconds", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addColumn("RouteRunStops", "DoneSource", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      // Arrêts déjà cochés avant cette phase : forcément à la main
      await queryInterface.sequelize.query(
        `UPDATE "RouteRunStops" SET "DoneSource" = 'manual' WHERE "Status" <> 'pending'`,
        { transaction }
      );
      await queryInterface.addColumn("RouteRuns", "GeofenceState", { type: Sequelize.JSONB, allowNull: true }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn("RouteRuns", "GeofenceState", { transaction });
      for (const column of ["DoneSource", "TravelSeconds", "ServiceSeconds", "DepartedAt", "ArrivedAt"]) {
        await queryInterface.removeColumn("RouteRunStops", column, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
