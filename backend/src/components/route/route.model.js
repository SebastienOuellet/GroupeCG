import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Route = sequelize.define(
    "Route",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      Description: {
        type: DataTypes.TEXT
      },
      OperatorUserId: {
        type: DataTypes.INTEGER
      },
      SortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: "Route",
      tableName: "Routes"
    }
  );

  Route.associate = (db) => {
    Route.belongsTo(db.User, { foreignKey: "OperatorUserId", as: "Operator" });
    Route.hasMany(db.Contract, { foreignKey: "RouteId", as: "Contracts" });
  };

  return Route;
};
