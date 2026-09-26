"use strict";

/** Adresse courriel à laquelle le contrat/la facture a été envoyé (null = marqué envoyé manuellement). */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Invoices", "SentToEmail", {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Invoices", "SentToEmail");
  }
};
