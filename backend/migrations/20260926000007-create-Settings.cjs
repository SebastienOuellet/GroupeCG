"use strict";

/**
 * Réglages modifiables par l'admin (clé → valeur JSON). Première clé :
 * "contract_terms" (valeurs imprimées dans les conditions du contrat PDF).
 * Absence de ligne = valeurs par défaut du code (contractTerms.js).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Settings", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      Value: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      UpdatedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "Id" },
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
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("Settings");
  }
};
