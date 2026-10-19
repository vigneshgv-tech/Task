const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const JobEvent = sequelize.define(
  "JobEvent",
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
    eventType: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "event_type",
    },
    actor: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "actor_id",
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "job_history",
    timestamps: true,
    underscored: true,
    createdAt: "eventTimestamp",
    updatedAt: false,
    indexes: [{ fields: ["job_id", "event_timestamp"] }],
  },
);

module.exports = JobEvent;
