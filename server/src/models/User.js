const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
    },
    passwordSalt: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "password_salt",
    },
    role: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
      field: "rider_id",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  },
);

module.exports = User;
