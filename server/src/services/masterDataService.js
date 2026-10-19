const { MasterRecord } = require("../models");

const seedRecords = [
  {
    domain: "zone",
    code: "north",
    value: "north",
    label: "North",
    sortOrder: 1,
  },
  {
    domain: "zone",
    code: "south",
    value: "south",
    label: "South",
    sortOrder: 2,
  },
  { domain: "zone", code: "east", value: "east", label: "East", sortOrder: 3 },
  { domain: "zone", code: "west", value: "west", label: "West", sortOrder: 4 },
  {
    domain: "zone",
    code: "central",
    value: "central",
    label: "Central",
    sortOrder: 5,
  },
  { domain: "status", code: "NEW", value: "NEW", label: "New", sortOrder: 1 },
  {
    domain: "status",
    code: "READY_FOR_ASSIGNMENT",
    value: "READY_FOR_ASSIGNMENT",
    label: "Ready for assignment",
    sortOrder: 2,
  },
  {
    domain: "status",
    code: "AWAITING_CONFIRMATION",
    value: "AWAITING_CONFIRMATION",
    label: "Awaiting confirmation",
    sortOrder: 3,
  },
  {
    domain: "status",
    code: "ACCEPTED",
    value: "ACCEPTED",
    label: "Accepted",
    sortOrder: 4,
  },
  {
    domain: "status",
    code: "PICKED_UP",
    value: "PICKED_UP",
    label: "Picked up",
    sortOrder: 5,
  },
  {
    domain: "status",
    code: "DELIVERED",
    value: "DELIVERED",
    label: "Delivered",
    sortOrder: 6,
  },
  {
    domain: "status",
    code: "MANUAL_QUEUE",
    value: "MANUAL_QUEUE",
    label: "Manual queue",
    sortOrder: 7,
  },
  {
    domain: "status",
    code: "CANCELLED",
    value: "CANCELLED",
    label: "Cancelled",
    sortOrder: 8,
  },
  { domain: "priority", code: "LOW", value: "LOW", label: "Low", sortOrder: 1 },
  {
    domain: "priority",
    code: "MEDIUM",
    value: "MEDIUM",
    label: "Medium",
    sortOrder: 2,
  },
  {
    domain: "priority",
    code: "HIGH",
    value: "HIGH",
    label: "High",
    sortOrder: 3,
  },
  {
    domain: "priority",
    code: "URGENT",
    value: "URGENT",
    label: "Urgent",
    sortOrder: 4,
  },
];

async function ensureMasterRecords() {
  for (const record of seedRecords) {
    await MasterRecord.findOrCreate({
      where: { domain: record.domain, code: record.code },
      defaults: record,
    });
  }

  return MasterRecord.findAll({
    order: [
      ["domain", "ASC"],
      ["sortOrder", "ASC"],
    ],
  });
}

async function getMasterRecords(domain) {
  return MasterRecord.findAll({
    where: { domain, isActive: true },
    order: [["sortOrder", "ASC"]],
  });
}

module.exports = {
  ensureMasterRecords,
  getMasterRecords,
};
