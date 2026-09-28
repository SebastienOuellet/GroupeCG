"use strict";

/**
 * Phase R3 des routes : taille de l'entrée (simple, double, triple, grande/commerciale).
 * Multiplie la durée de déneigement estimée par l'optimiseur. Nullable : non précisé = simple.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ServiceAddresses", "DrivewaySize", { type: Sequelize.STRING(20), allowNull: true });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ServiceAddresses", "DrivewaySize");
  }
};
