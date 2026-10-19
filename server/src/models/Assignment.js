const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Assignment = sequelize.define(
  "Assignment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    jobId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "job_id",
    },
    riderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "rider_id",
    },
    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "attempt_number",
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "PENDING",
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "assigned_at",
    },
    responseDeadline: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "confirmation_deadline",
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "confirmed_at",
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "rejected_at",
    },
    timedOutAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "timeout_at",
    },
  },
  {
    tableName: "assignments",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["job_id", "status"] }],
  },
);

module.exports = Assignment;
