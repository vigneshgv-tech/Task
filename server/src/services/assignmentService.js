const { Op } = require("sequelize");
const { sequelize, Job, Rider, Assignment, JobEvent } = require("../models");
const {
  computeRecommendations,
  validateStatusTransition,
  assertJobAssignable,
  isAssignmentOverdue,
} = require("./dispatchService");
const {
  reserveDeliveryCapacity,
  releaseDeliveryCapacity,
} = require("./riderCapacityService");

function getAssignmentTimeoutMinutes() {
  return Number(process.env.ASSIGNMENT_TIMEOUT_MINUTES || 2);
}

function serializeRider(rider) {
  if (!rider) return null;
  const plain = rider.get ? rider.get({ plain: true }) : rider;
  return {
    ...plain,
    rider_reference: plain.riderReference,
    availability_status: plain.availabilityStatus,
    total_capacity: plain.totalCapacity,
    available_capacity: plain.availableCapacity,
    current_zone: plain.currentZone,
    supported_zones: plain.supportedZones || [],
    service_zones: plain.supportedZones || [],
    capacity: plain.totalCapacity,
    availability: plain.availabilityStatus,
    current_workload: plain.currentWorkload,
  };
}

function serializeJob(job) {
  if (!job) return null;
  const plain = job.get ? job.get({ plain: true }) : job;
  return {
    ...plain,
    order_reference: plain.jobReference,
    delivery_deadline: plain.deadline,
    current_status: plain.status,
    job_reference: plain.jobReference,
    pickup_zone: plain.pickupZone,
    delivery_zone: plain.deliveryZone,
    load_capacity: plain.loadCapacity,
    assigned_rider_id: plain.assignedRiderId,
    created_at: plain.createdAt,
    updated_at: plain.updatedAt,
  };
}

function serializeAssignment(assignment) {
  const plain = assignment.get ? assignment.get({ plain: true }) : assignment;
  return {
    ...plain,
    job_id: plain.jobId,
    rider_id: plain.riderId,
    attempt_number: plain.attemptNumber,
    assigned_at: plain.assignedAt,
    confirmation_deadline: plain.responseDeadline,
    confirmed_at: plain.acceptedAt,
    rejected_at: plain.rejectedAt,
    timeout_at: plain.timedOutAt,
  };
}

async function recordJobEvent(
  jobId,
  eventType,
  details = {},
  actor = "system",
  assignmentId = null,
  options = {},
) {
  const eventDetails = assignmentId
    ? { ...details, assignment_id: assignmentId }
    : details;
  return JobEvent.create(
    {
      jobId,
      eventType,
      actor,
      details: eventDetails,
    },
    options,
  );
}

async function applyCapacityUpdate(rider, capacity, options = {}) {
  return rider.update(capacity, options);
}

async function releaseReservedCapacity(job, rider, reason, actor, options = {}) {
  if (!rider) return null;
  const capacity = releaseDeliveryCapacity(rider, job.loadCapacity);
  await applyCapacityUpdate(rider, capacity, options);
  await recordJobEvent(
    job.id,
    "RIDER_CAPACITY_RELEASED",
    {
      rider_id: rider.id,
      load: Number(job.loadCapacity),
      current_workload: capacity.currentWorkload,
      available_capacity: capacity.availableCapacity,
      reason,
    },
    actor,
    null,
    options,
  );
  return capacity;
}

async function assignRiderToJob(jobId, payload) {
  const { rider_id, actor = "dispatcher", override_reason = "" } = payload;
  const transaction = await sequelize.transaction();
  try {
    const job = await Job.findByPk(jobId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }
    const pendingAssignment = await Assignment.findOne({
      where: { jobId: job.id, status: "PENDING" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    assertJobAssignable(job, pendingAssignment);

    const rider = await Rider.findByPk(rider_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!rider) {
      const error = new Error("Rider not found");
      error.statusCode = 404;
      throw error;
    }

    const allRiders = await Rider.findAll({
      order: [["name", "ASC"]],
      transaction,
    });
    const recommendations = computeRecommendations(
      serializeJob(job),
      allRiders.map(serializeRider),
    );
    const isEligible = recommendations.some(
      (item) => Number(item.rider.id) === Number(rider_id),
    );
    if (!isEligible) {
      const error = new Error("Rider is not eligible for this job");
      error.statusCode = 400;
      throw error;
    }

    const isOverride =
      recommendations.length > 0 &&
      Number(recommendations[0].rider.id) !== Number(rider_id);
    if (isOverride && !String(override_reason).trim()) {
      const error = new Error(
        "An override reason is required when choosing another rider",
      );
      error.statusCode = 400;
      throw error;
    }

    const capacity = reserveDeliveryCapacity(rider, job.loadCapacity);
    await applyCapacityUpdate(rider, capacity, { transaction });

    const responseDeadline = new Date(
      Date.now() + getAssignmentTimeoutMinutes() * 60 * 1000,
    );
    const attemptNumber =
      (await Assignment.count({ where: { jobId: job.id }, transaction })) + 1;
    const assignment = await Assignment.create(
      {
        jobId: job.id,
        riderId: rider.id,
        attemptNumber,
        assignedAt: new Date(),
        status: "PENDING",
        responseDeadline,
      },
      { transaction },
    );

    await job.update(
      {
        status: "AWAITING_CONFIRMATION",
        assignedRiderId: rider.id,
      },
      { transaction },
    );

    await recordJobEvent(
      job.id,
      "RIDERS_RECOMMENDED",
      {
        recommended_rider_ids: recommendations
          .slice(0, 3)
          .map((item) => item.rider.id),
        top_rider_id: recommendations[0]?.rider.id || null,
        reasons: recommendations[0]?.reasons || [],
      },
      actor,
      assignment.id,
      { transaction },
    );
    await recordJobEvent(
      job.id,
      "ASSIGNMENT_CREATED",
      {
        rider_id: rider.id,
        response_deadline: responseDeadline.toISOString(),
        override_reason: isOverride ? String(override_reason).trim() : null,
        reserved_capacity: Number(job.loadCapacity),
        current_workload: capacity.currentWorkload,
        available_capacity: capacity.availableCapacity,
      },
      actor,
      assignment.id,
      { transaction },
    );
    if (isOverride) {
      await recordJobEvent(
        job.id,
        "MANUAL_OVERRIDE",
        {
          recommended_rider_id: recommendations[0].rider.id,
          assigned_rider_id: rider.id,
          reason: String(override_reason).trim(),
        },
        actor,
        assignment.id,
        { transaction },
      );
    }

    await transaction.commit();
    return {
      assignment: serializeAssignment(assignment),
      job: serializeJob(await Job.findByPk(job.id)),
    };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

async function confirmAssignment(jobId, payload) {
  const { action, actor = "rider" } = payload;
  const transaction = await sequelize.transaction();
  try {
    const job = await Job.findByPk(jobId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }
    const assignment = await Assignment.findOne({
      where: { jobId: job.id, status: "PENDING" },
      order: [["createdAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!assignment) {
      const error = new Error(
        "No pending assignment available for confirmation",
      );
      error.statusCode = 409;
      throw error;
    }

    const rider = await Rider.findByPk(assignment.riderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (action === "ACCEPT") {
      validateStatusTransition(job.status, "ACCEPTED");
      await assignment.update(
        { status: "ACCEPTED", acceptedAt: new Date() },
        { transaction },
      );
      await job.update(
        {
          status: "ACCEPTED",
          assignedRiderId: assignment.riderId,
        },
        { transaction },
      );
      await recordJobEvent(
        job.id,
        "ASSIGNMENT_ACCEPTED",
        {
          rider_id: assignment.riderId,
          load: Number(job.loadCapacity),
          current_workload: rider?.currentWorkload,
          available_capacity: rider?.availableCapacity,
        },
        actor,
        assignment.id,
        { transaction },
      );
      await transaction.commit();
      return { ok: true, message: "Assignment accepted" };
    }

    if (action === "REJECT") {
      await assignment.update(
        { status: "REJECTED", rejectedAt: new Date() },
        { transaction },
      );
      await job.update(
        {
          status: "MANUAL_QUEUE",
          assignedRiderId: null,
        },
        { transaction },
      );
      if (rider) {
        await releaseReservedCapacity(
          job,
          rider,
          "Rider rejected assignment",
          actor,
          { transaction },
        );
      }
      await recordJobEvent(
        job.id,
        "ASSIGNMENT_REJECTED",
        {
          rider_id: assignment.riderId,
          reason: "Rider rejected assignment",
        },
        actor,
        assignment.id,
        { transaction },
      );
      await recordJobEvent(
        job.id,
        "MOVED_TO_MANUAL_QUEUE",
        { reason: "Rider rejected assignment" },
        actor,
        assignment.id,
        { transaction },
      );
      await transaction.commit();
      return {
        ok: true,
        message: "Assignment rejected and moved to manual queue",
      };
    }

    const error = new Error("Action must be ACCEPT or REJECT");
    error.statusCode = 400;
    throw error;
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

async function timeoutAssignment(jobId, actor = "system", force = false) {
  const transaction = await sequelize.transaction();
  try {
    const job = await Job.findByPk(jobId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }
    const assignment = await Assignment.findOne({
      where: { jobId: job.id, status: "PENDING" },
      order: [["createdAt", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!assignment) {
      const error = new Error("No pending assignment to time out");
      error.statusCode = 409;
      throw error;
    }
    if (!force && !isAssignmentOverdue(assignment)) {
      const error = new Error(
        "Assignment has not exceeded the confirmation threshold yet",
      );
      error.statusCode = 409;
      throw error;
    }

    const rider = await Rider.findByPk(assignment.riderId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await assignment.update(
      { status: "TIMED_OUT", timedOutAt: new Date() },
      { transaction },
    );
    await job.update(
      {
        status: "MANUAL_QUEUE",
        assignedRiderId: null,
      },
      { transaction },
    );
    if (rider) {
      await releaseReservedCapacity(
        job,
        rider,
        "Assignment expired without rider confirmation",
        actor,
        { transaction },
      );
    }
    await recordJobEvent(
      job.id,
      "ASSIGNMENT_TIMEOUT",
      {
        rider_id: assignment.riderId,
        reason: "Assignment expired without rider confirmation",
      },
      actor,
      assignment.id,
      { transaction },
    );
    await recordJobEvent(
      job.id,
      "MOVED_TO_MANUAL_QUEUE",
      { reason: "Assignment expired without rider confirmation" },
      actor,
      assignment.id,
      { transaction },
    );
    await transaction.commit();
    return {
      ok: true,
      message: "Assignment timed out and moved to manual queue",
      job: serializeJob(await Job.findByPk(job.id)),
    };
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

async function processExpiredAssignments(now = new Date()) {
  const expired = await Assignment.findAll({
    where: {
      status: "PENDING",
      responseDeadline: { [Op.lte]: now },
    },
  });
  const results = [];
  for (const assignment of expired) {
    try {
      results.push(await timeoutAssignment(assignment.jobId, "system", true));
    } catch (error) {
      if (error.statusCode !== 409) {
        console.error(
          `Failed to time out assignment ${assignment.id}:`,
          error.message,
        );
      }
    }
  }
  return results;
}

module.exports = {
  getAssignmentTimeoutMinutes,
  serializeRider,
  serializeJob,
  serializeAssignment,
  recordJobEvent,
  assignRiderToJob,
  confirmAssignment,
  timeoutAssignment,
  processExpiredAssignments,
  releaseReservedCapacity,
};
