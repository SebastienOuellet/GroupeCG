"use strict";

/** Type de revêtement de l'entrée (voir serviceAddress.constants.js). Nullable : inconnu pour l'existant. */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ServiceAddresses", "DrivewaySurface", {
      type: Sequelize.STRING(20),
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ServiceAddresses", "DrivewaySurface");
  }
};
