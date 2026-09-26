"use strict";

/**
 * Coordonnées de l'adresse de service, fournies par l'autocomplete Google Places.
 * Nullables : les adresses existantes sont géocodées à la volée à la première ouverture
 * de la vue Street View, puis enregistrées.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("ServiceAddresses", "Latitude", {
      type: Sequelize.DECIMAL(9, 6),
      allowNull: true
    });
    await queryInterface.addColumn("ServiceAddresses", "Longitude", {
      type: Sequelize.DECIMAL(9, 6),
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("ServiceAddresses", "Longitude");
    await queryInterface.removeColumn("ServiceAddresses", "Latitude");
  }
};
