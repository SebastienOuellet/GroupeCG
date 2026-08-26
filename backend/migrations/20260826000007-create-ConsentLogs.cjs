"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("ConsentLogs", {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      PersonType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      PersonId: {
        type: Sequelize.INTEGER
      },
      Channel: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Address: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      Method: {
        type: Sequelize.STRING,
        allowNull: false
      },
      ActorUserId: {
        type: Sequelize.INTEGER,
        references: { model: "Users", key: "Id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      IpAddress: {
        type: Sequelize.STRING
      },
      Metadata: {
        type: Sequelize.JSONB
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

    await queryInterface.addIndex("ConsentLogs", ["Address"], { name: "consent_logs_address_idx" });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("ConsentLogs");
  }
};
