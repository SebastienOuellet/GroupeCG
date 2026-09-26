"use strict";

/**
 * Conditions du contrat figées à l'envoi (comme les montants) : un contrat
 * envoyé se re-télécharge toujours avec les conditions que le client a reçues,
 * même si Paramètres › Contrat change ensuite. Null = pas encore envoyé.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Invoices", "TermsSnapshot", {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Invoices", "TermsSnapshot");
  }
};
