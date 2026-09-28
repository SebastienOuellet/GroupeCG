"use strict";

/**
 * Phase R1 des routes : ordre de passage.
 *  - Contracts.RouteSequence : position dans la route (null = pas encore placé, affiché à la fin).
 *  - RouteRunStops.Sequence  : copie figée de l'ordre au démarrage de la tournée.
 *  - ServiceAddresses.PlaceId / LocationSource / LocationUpdatedAt : conformité Google
 *    (seul le place_id est stockable indéfiniment ; les coordonnées Google sont un cache daté).
 *  - Routes : traçabilité de l'ordre en vigueur + point d'attache du véhicule (remplace le dépôt).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn("Contracts", "RouteSequence", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.addIndex("Contracts", ["RouteId", "RouteSequence"], { name: "contracts_route_sequence", transaction });

      // Tournées existantes : ordre de création (le seul qu'elles aient jamais eu)
      await queryInterface.addColumn("RouteRunStops", "Sequence", { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      await queryInterface.sequelize.query(
        `UPDATE "RouteRunStops" s SET "Sequence" = o.rn
           FROM (SELECT "Id", ROW_NUMBER() OVER (PARTITION BY "RouteRunId" ORDER BY "Id") AS rn FROM "RouteRunStops") o
          WHERE s."Id" = o."Id"`,
        { transaction }
      );
      await queryInterface.changeColumn("RouteRunStops", "Sequence", { type: Sequelize.INTEGER, allowNull: false }, { transaction });

      await queryInterface.addColumn("ServiceAddresses", "PlaceId", { type: Sequelize.STRING(255), allowNull: true }, { transaction });
      await queryInterface.addColumn("ServiceAddresses", "LocationSource", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn("ServiceAddresses", "LocationUpdatedAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
      // Coordonnées déjà en base : toutes viennent de Google (autocomplete ou recherche texte)
      await queryInterface.sequelize.query(
        `UPDATE "ServiceAddresses" SET "LocationSource" = 'google_places', "LocationUpdatedAt" = "updatedAt"
          WHERE "Latitude" IS NOT NULL AND "Longitude" IS NOT NULL`,
        { transaction }
      );

      await queryInterface.addColumn("Routes", "SequenceSource", { type: Sequelize.STRING(20), allowNull: true }, { transaction });
      await queryInterface.addColumn("Routes", "SequenceUpdatedAt", { type: Sequelize.DATE, allowNull: true }, { transaction });
      await queryInterface.addColumn(
        "Routes",
        "SequenceUpdatedByUserId",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "Users", key: "Id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        { transaction }
      );
      await queryInterface.addColumn("Routes", "BaseLocation", { type: Sequelize.JSONB, allowNull: true }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Routes", "BaseLocation");
    await queryInterface.removeColumn("Routes", "SequenceUpdatedByUserId");
    await queryInterface.removeColumn("Routes", "SequenceUpdatedAt");
    await queryInterface.removeColumn("Routes", "SequenceSource");
    await queryInterface.removeColumn("ServiceAddresses", "LocationUpdatedAt");
    await queryInterface.removeColumn("ServiceAddresses", "LocationSource");
    await queryInterface.removeColumn("ServiceAddresses", "PlaceId");
    await queryInterface.removeColumn("RouteRunStops", "Sequence");
    await queryInterface.removeIndex("Contracts", "contracts_route_sequence");
    await queryInterface.removeColumn("Contracts", "RouteSequence");
  }
};
