const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MasterRecord = sequelize.define(
  "MasterRecord",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    domain: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: false,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "master_records",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["domain", "code"],
      },
    ],
  },
);

module.exports = MasterRecord;
