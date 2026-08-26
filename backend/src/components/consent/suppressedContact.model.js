import { DataTypes } from "sequelize";

export default (sequelize) => {
  return sequelize.define(
    "SuppressedContact",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
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
      Reason: {
        type: DataTypes.STRING,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: "SuppressedContact",
      tableName: "SuppressedContacts",
      indexes: [{ unique: true, fields: ["Channel", "Address"] }]
    }
  );
};
