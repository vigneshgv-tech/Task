const { sequelize } = require("../config/database");
const MasterRecord = require("./MasterRecord");
const Rider = require("./Rider");
const Job = require("./Job");
const Assignment = require("./Assignment");
const JobEvent = require("./JobEvent");
const User = require("./User");

Job.belongsTo(Rider, { foreignKey: "assignedRiderId", as: "assignedRider" });
Rider.hasMany(Job, { foreignKey: "assignedRiderId", as: "jobs" });

Assignment.belongsTo(Job, { foreignKey: "jobId" });
Job.hasMany(Assignment, { foreignKey: "jobId", as: "assignments" });

Assignment.belongsTo(Rider, { foreignKey: "riderId" });
Rider.hasMany(Assignment, { foreignKey: "riderId", as: "assignments" });

JobEvent.belongsTo(Job, { foreignKey: "jobId" });
Job.hasMany(JobEvent, { foreignKey: "jobId", as: "events" });

User.belongsTo(Rider, { foreignKey: "riderId", as: "rider" });
Rider.hasOne(User, { foreignKey: "riderId", as: "user" });

module.exports = {
  sequelize,
  MasterRecord,
  Rider,
  Job,
  Assignment,
  JobEvent,
  User,
};
