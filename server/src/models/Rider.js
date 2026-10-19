const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Rider = sequelize.define(
  "Rider",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    riderReference: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: "rider_reference",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    availabilityStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "AVAILABLE",
      field: "availability_status",
    },
    totalCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "total_capacity",
    },
    availableCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "available_capacity",
    },
    currentWorkload: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "current_workload",
    },
    currentZone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "current_zone",
    },
    supportedZones: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      field: "supported_zones",
    },
  },
  {
    tableName: "riders",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Rider;
