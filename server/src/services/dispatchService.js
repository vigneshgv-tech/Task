const crypto = require("crypto");

const JOB_STATUSES = [
  "NEW",
  "READY_FOR_ASSIGNMENT",
  "AWAITING_CONFIRMATION",
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
  "MANUAL_QUEUE",
  "CANCELLED",
];

const PRIORITY_WEIGHT = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const ZONE_TRAVEL_MINUTES = {
  north: { north: 8, central: 18, south: 32, east: 22, west: 28 },
  central: { north: 18, central: 7, south: 16, east: 14, west: 15 },
  south: { north: 32, central: 16, south: 9, east: 24, west: 20 },
  east: { north: 22, central: 14, south: 24, east: 8, west: 30 },
  west: { north: 28, central: 15, south: 20, east: 30, west: 8 },
};

function normalizeZoneList(zones) {
  if (!zones) return [];
  if (Array.isArray(zones)) return zones.map((z) => String(z).toLowerCase());
  return String(zones)
    .split(",")
    .map((zone) => zone.trim().toLowerCase())
    .filter(Boolean);
}

function createDuplicateHash(payload) {
  const normalized = JSON.stringify(
    Object.keys(payload || {})
      .sort()
      .reduce((acc, key) => {
        const value = payload[key];
        if (value !== undefined && value !== null && value !== "") {
          acc[key] = value;
        }
        return acc;
      }, {}),
  );

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function validateStatusTransition(currentStatus, nextStatus) {
  const allowed = {
    NEW: ["READY_FOR_ASSIGNMENT", "CANCELLED"],
    READY_FOR_ASSIGNMENT: [
      "AWAITING_CONFIRMATION",
      "MANUAL_QUEUE",
      "CANCELLED",
    ],
    AWAITING_CONFIRMATION: ["ACCEPTED", "MANUAL_QUEUE", "CANCELLED"],
    ACCEPTED: ["PICKED_UP", "CANCELLED"],
    PICKED_UP: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    MANUAL_QUEUE: [
      "READY_FOR_ASSIGNMENT",
      "AWAITING_CONFIRMATION",
      "CANCELLED",
    ],
    CANCELLED: [],
  };

  if (!allowed[currentStatus]) {
    throw new Error(`Unknown current status: ${currentStatus}`);
  }

  if (!allowed[currentStatus].includes(nextStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${nextStatus}`,
    );
  }

  return true;
}

function getEstimatedTravelMinutes(pickupZone, deliveryZone) {
  const pickup = String(pickupZone || "").toLowerCase();
  const delivery = String(deliveryZone || "").toLowerCase();
  return ZONE_TRAVEL_MINUTES[pickup]?.[delivery] ?? 25;
}

function getMinutesUntilDeadline(deadline, now = Date.now()) {
  if (!deadline) return null;
  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;
  return Math.round((deadlineMs - now) / 60000);
}

function assertJobAssignable(job, pendingAssignment) {
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }
  if (!["READY_FOR_ASSIGNMENT", "MANUAL_QUEUE"].includes(job.status)) {
    const error = new Error(
      "Only jobs ready for assignment or in the manual queue can be assigned",
    );
    error.statusCode = 409;
    throw error;
  }
  if (pendingAssignment) {
    const error = new Error(
      "This job already has a pending assignment. Confirm, reject, or time it out first",
    );
    error.statusCode = 409;
    throw error;
  }
  return true;
}

function isAssignmentOverdue(assignment, now = new Date()) {
  if (!assignment || assignment.status !== "PENDING") return false;
  const deadline = new Date(
    assignment.responseDeadline || assignment.confirmation_deadline,
  );
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime();
}

function computeRecommendations(job, riders = [], now = Date.now()) {
  if (!job) return [];

  const jobPickup = String(job.pickup_zone || "").toLowerCase();
  const jobDelivery = String(job.delivery_zone || "").toLowerCase();
  const load = Number(job.load_capacity || 0);
  const minutesUntilDeadline = getMinutesUntilDeadline(job.deadline, now);
  const travelMinutes = getEstimatedTravelMinutes(jobPickup, jobDelivery);

  const eligible = riders.filter((rider) => {
    const serviceZones = normalizeZoneList(
      rider.supported_zones || rider.service_zones,
    );
    const totalCapacity = Number(rider.total_capacity || rider.capacity || 0);
    const availableCapacity = Number(
      rider.available_capacity ?? rider.capacity ?? 0,
    );
    const available =
      (rider.availability_status || rider.availability) === "AVAILABLE";
    const servesZones =
      String(rider.current_zone || "").toLowerCase() === jobPickup &&
      serviceZones.includes(jobDelivery);
    const hasCapacity = availableCapacity >= load;
    const currentWorkload = Number(rider.current_workload || 0);
    const workloadOk = currentWorkload + load <= totalCapacity;
    return available && servesZones && hasCapacity && workloadOk;
  });

  return eligible
    .map((rider) => {
      const currentWorkload = Number(rider.current_workload || 0);
      const capacity = Number(rider.total_capacity || rider.capacity || 0);
      const deadlineBoost =
        minutesUntilDeadline == null
          ? 10
          : Math.max(0, 40 - Math.min(minutesUntilDeadline, 240) / 6);
      const score =
        (PRIORITY_WEIGHT[String(job.priority || "LOW")] || 1) * 50 +
        (capacity - currentWorkload) * 3 +
        deadlineBoost -
        currentWorkload * 2 -
        travelMinutes;

      const reasons = [
        `Located in ${jobPickup} and supports delivery to ${jobDelivery}`,
        `Capacity ${capacity} with current workload ${currentWorkload}`,
        `Estimated travel ${travelMinutes} minutes between zones`,
        minutesUntilDeadline == null
          ? `Priority ${job.priority || "LOW"} with no deadline`
          : `Priority ${job.priority || "LOW"} with deadline in ${minutesUntilDeadline} minutes`,
      ];

      return { rider, score, reasons, travelMinutes };
    })
    .sort((a, b) => b.score - a.score || a.travelMinutes - b.travelMinutes);
}

module.exports = {
  JOB_STATUSES,
  ZONE_TRAVEL_MINUTES,
  createDuplicateHash,
  validateStatusTransition,
  computeRecommendations,
  getEstimatedTravelMinutes,
  assertJobAssignable,
  isAssignmentOverdue,
  PRIORITY_WEIGHT,
};
