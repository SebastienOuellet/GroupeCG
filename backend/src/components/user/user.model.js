import { DataTypes } from "sequelize";

export default (sequelize) => {
  return sequelize.define(
    "User",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      FirebaseUid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      Email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      Name: {
        type: DataTypes.STRING
      },
      Role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "user"
      }
    },
    {
      sequelize,
      modelName: "User",
      tableName: "Users"
    }
  );
};
