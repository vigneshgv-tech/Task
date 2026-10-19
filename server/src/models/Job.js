const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Job = sequelize.define(
  "Job",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    jobReference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: "order_reference",
    },
    pickupZone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "pickup_zone",
    },
    deliveryZone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "delivery_zone",
    },
    loadCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "load_capacity",
    },
    priority: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "MEDIUM",
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal("NOW()"),
      field: "delivery_deadline",
    },
    status: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "NEW",
      field: "current_status",
    },
    assignedRiderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_rider_id",
    },
    duplicateHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
      field: "duplicate_hash",
    },
  },
  {
    tableName: "jobs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["current_status"] },
      { fields: ["pickup_zone", "delivery_zone"] },
      { unique: true, fields: ["duplicate_hash"] },
    ],
  },
);

module.exports = Job;
