import { DataTypes } from "sequelize";

/** Réglage modifiable par l'admin : une ligne par clé, valeur JSON. */
export default (sequelize) => {
  const Setting = sequelize.define(
    "Setting",
    {
      Id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      Key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      Value: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      UpdatedByUserId: {
        type: DataTypes.INTEGER
      }
    },
    {
      sequelize,
      modelName: "Setting",
      tableName: "Settings"
    }
  );

  Setting.associate = (db) => {
    Setting.belongsTo(db.User, { foreignKey: "UpdatedByUserId", as: "UpdatedBy" });
  };

  return Setting;
};
