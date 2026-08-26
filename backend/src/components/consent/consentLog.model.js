import { DataTypes } from "sequelize";

export default (sequelize) => {
  const ConsentLog = sequelize.define(
    "ConsentLog",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      PersonType: {
        type: DataTypes.STRING,
        allowNull: false
      },
      PersonId: {
        type: DataTypes.INTEGER
      },
      Channel: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Address: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Action: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Method: {
        type: DataTypes.STRING,
        allowNull: false
      },
      ActorUserId: {
        type: DataTypes.INTEGER
      },
      IpAddress: {
        type: DataTypes.STRING
      },
      Metadata: {
        type: DataTypes.JSONB
      }
    },
    {
      sequelize,
      modelName: "ConsentLog",
      tableName: "ConsentLogs"
    }
  );

  ConsentLog.associate = (db) => {
    ConsentLog.belongsTo(db.User, { foreignKey: "ActorUserId", as: "Actor" });
  };

  return ConsentLog;
};
