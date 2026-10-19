const { Op } = require("sequelize");
const { Job, JobEvent, Assignment, Rider } = require("../models");
const {
  validateStatusTransition,
  createDuplicateHash,
  computeRecommendations,
} = require("./dispatchService");
const { recordJobEvent, serializeRider } = require("./assignmentService");

function buildDuplicatePayload(payload) {
  return {
    pickup_zone: payload.pickupZone || payload.pickup_zone,
    delivery_zone: payload.deliveryZone || payload.delivery_zone,
    load_capacity: Number(payload.loadCapacity || payload.load_capacity || 0),
    priority: payload.priority || "MEDIUM",
    deadline: payload.deadline || null,
  };
}

async function listJobs(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.zone) {
    where[Op.or] = [
      { pickupZone: filters.zone },
      { deliveryZone: filters.zone },
    ];
  }

  if (filters.search) {
    where.jobReference = { [Op.iLike]: `%${String(filters.search)}%` };
  }

  return Job.findAll({
    where,
    include: [{ model: Rider, as: "assignedRider" }],
    order: [["createdAt", "DESC"]],
  });
}

async function getJobById(id) {
  return Job.findByPk(id, {
    include: [
      { model: Rider, as: "assignedRider" },
      { model: Assignment, as: "assignments" },
      { model: JobEvent, as: "events" },
    ],
  });
}

async function createJob(payload) {
  const pickupZone = payload.pickupZone || payload.pickup_zone;
  const deliveryZone = payload.deliveryZone || payload.delivery_zone;
  const loadCapacity = Number(
    payload.loadCapacity || payload.load_capacity || 0,
  );
  const priority = payload.priority || "MEDIUM";
  const deadline = payload.deadline || null;
  const duplicateHash = createDuplicateHash(buildDuplicatePayload(payload));
  const existingJob = await Job.findOne({ where: { duplicateHash } });
  if (existingJob) {
    return { duplicate: true, job: existingJob };
  }

  const job = await Job.create({
    jobReference: `REL-${Date.now()}`,
    pickupZone,
    deliveryZone,
    loadCapacity,
    priority,
    deadline: deadline || new Date(Date.now() + 4 * 60 * 60 * 1000),
    status: "NEW",
    duplicateHash,
  });

  await recordJobEvent(
    job.id,
    "JOB_CREATED",
    {
      pickupZone: job.pickupZone,
      deliveryZone: job.deliveryZone,
      loadCapacity: job.loadCapacity,
      priority: job.priority,
      deadline: job.deadline,
    },
    payload.actor || "dispatcher",
  );

  await job.update({ status: "READY_FOR_ASSIGNMENT" });
  await recordJobEvent(
    job.id,
    "STATUS_UPDATED",
    { status: "READY_FOR_ASSIGNMENT" },
    payload.actor || "dispatcher",
  );

  const riders = await Rider.findAll();
  const recommendations = computeRecommendations(
    {
      pickup_zone: job.pickupZone,
      delivery_zone: job.deliveryZone,
      load_capacity: job.loadCapacity,
      priority: job.priority,
      deadline: job.deadline,
    },
    riders.map(serializeRider),
  );

  if (recommendations.length === 0) {
    await job.update({ status: "MANUAL_QUEUE" });
    await recordJobEvent(
      job.id,
      "MOVED_TO_MANUAL_QUEUE",
      { reason: "No eligible rider available" },
      payload.actor || "dispatcher",
    );
  }

  return { duplicate: false, job: await Job.findByPk(job.id) };
}

async function updateJobStatus(
  id,
  nextStatus,
  actor = "dispatcher",
  options = {},
) {
  const job = await Job.findByPk(id, options);
  if (!job) {
    throw new Error("Job not found");
  }

  validateStatusTransition(job.status, nextStatus);
  job.status = nextStatus;
  await job.save(options);

  await JobEvent.create(
    {
      jobId: job.id,
      eventType: "STATUS_UPDATED",
      actor,
      details: { status: nextStatus },
    },
    options,
  );

  return job;
}

module.exports = {
  listJobs,
  getJobById,
  createJob,
  updateJobStatus,
  buildDuplicatePayload,
};
