const express = require("express");
const cors = require("cors");
const { initializeDatabase } = require("./db/init");
const { Op } = require("sequelize");
const { sequelize, Job, Rider, Assignment, JobEvent } = require("./models");
const {
  validateStatusTransition,
  computeRecommendations,
} = require("./services/dispatchService");
const {
  listRiders,
  getRiderById,
  createRider,
  updateRider,
} = require("./services/riderService");
const { getMasterRecords } = require("./services/masterDataService");
const {
  registerUser,
  loginUser,
  getUserFromSessionToken,
} = require("./services/authService");
const {
  serializeRider,
  serializeJob,
  serializeAssignment,
  recordJobEvent,
  assignRiderToJob,
  confirmAssignment,
  timeoutAssignment,
  processExpiredAssignments,
  getAssignmentTimeoutMinutes,
  releaseReservedCapacity,
} = require("./services/assignmentService");
const {
  listJobs,
  getJobById,
  createJob,
  updateJobStatus,
} = require("./services/jobService");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

function serializeEvent(event) {
  if (!event) return null;
  const plain = event.get ? event.get({ plain: true }) : event;
  return {
    ...plain,
    job_id: plain.jobId,
    assignment_id: plain.details?.assignment_id,
    event_type: plain.eventType,
    event_timestamp: plain.eventTimestamp,
    actor_id: plain.actor,
    created_at: plain.eventTimestamp,
  };
}

async function getJobByIdOrThrow(jobId) {
  const job = await getJobById(jobId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }
  return job;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "relay-server" });
});

app.get("/api/config", (req, res) => {
  res.json({
    assignment_timeout_minutes: getAssignmentTimeoutMinutes(),
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const account = await registerUser(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const session = await loginUser(req.body);
    res.json(session);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get("/api/auth/session", async (req, res) => {
  try {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    const user = await getUserFromSessionToken(token);
    if (!user) return res.status(401).json({ message: "Session expired" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const jobs = await Job.findAll({ attributes: ["status"] });
    const riderCount = await Rider.count();

    const summary = {
      total_jobs: jobs.length,
      waiting_assignment: jobs.filter((job) =>
        ["NEW", "READY_FOR_ASSIGNMENT"].includes(job.status),
      ).length,
      awaiting_confirmation: jobs.filter(
        (job) => job.status === "AWAITING_CONFIRMATION",
      ).length,
      in_progress: jobs.filter((job) =>
        ["ACCEPTED", "PICKED_UP"].includes(job.status),
      ).length,
      manual_queue: jobs.filter((job) => job.status === "MANUAL_QUEUE").length,
      completed: jobs.filter((job) => job.status === "DELIVERED").length,
      cancelled: jobs.filter((job) => job.status === "CANCELLED").length,
    };

    res.json({ summary, riders: { rider_count: riderCount } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/riders", async (req, res) => {
  try {
    const riders = await listRiders();
    res.json({ riders: riders.map(serializeRider) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/riders/:id", async (req, res) => {
  try {
    const rider = await getRiderById(req.params.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }
    res.json({ rider: serializeRider(rider) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/riders", async (req, res) => {
  try {
    const { name, current_zone, supported_zones, total_capacity } = req.body;
    if (
      !name ||
      !current_zone ||
      !Array.isArray(supported_zones) ||
      !total_capacity
    ) {
      return res.status(400).json({
        message:
          "name, current_zone, supported_zones and total_capacity are required",
      });
    }
    const rider = await createRider(req.body);
    res.status(201).json({ rider: serializeRider(rider) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/api/riders/:id", async (req, res) => {
  try {
    const supportedZones = req.body.supported_zones;
    const currentZone = req.body.current_zone;
    if (currentZone || supportedZones) {
      const records = await getMasterRecords("zone");
      const validZones = new Set(records.map((record) => record.value));
      if (
        (currentZone && !validZones.has(currentZone)) ||
        (supportedZones &&
          (!Array.isArray(supportedZones) ||
            supportedZones.some((zone) => !validZones.has(zone))))
      ) {
        return res.status(400).json({
          message: "Choose current and supported zones from the zone list",
        });
      }
    }
    const rider = await updateRider(req.params.id, req.body);
    if (!rider) return res.status(404).json({ message: "Rider not found" });
    res.json({ rider: serializeRider(rider) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get("/api/master-records/:domain", async (req, res) => {
  try {
    const records = await getMasterRecords(req.params.domain);
    res.json({ records: records.map((record) => record.get({ plain: true })) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/manual-queue", async (req, res) => {
  try {
    const jobs = await listJobs({ status: "MANUAL_QUEUE" });
        const history = jobs.length
      ? await JobEvent.findAll({
          where: { jobId: { [Op.in]: jobs.map((job) => job.id) } },
          order: [["eventTimestamp", "DESC"]],
        })
      : [];
    const reasonByJob = {};
    for (const event of history) {
      if (!reasonByJob[event.jobId] && event.details?.reason) {
        reasonByJob[event.jobId] = event.details.reason;
      }
    }
    res.json({
      jobs: jobs.map((job) => ({
        ...serializeJob(job),
        manual_queue_reason: reasonByJob[job.id] || null,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/jobs", async (req, res) => {
  try {
    const { status, zone, search } = req.query;
    const jobs = await listJobs({ status, zone, search });
    res.json({ jobs: jobs.map(serializeJob) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/jobs", async (req, res) => {
  try {
    const { pickup_zone, delivery_zone, load_capacity, priority, deadline } =
      req.body;

    if (!pickup_zone || !delivery_zone || !load_capacity) {
      return res.status(400).json({
        message: "pickup_zone, delivery_zone and load_capacity are required",
      });
    }

    const result = await createJob({
      pickup_zone,
      delivery_zone,
      loadCapacity: load_capacity,
      priority,
      deadline,
      actor: req.body.actor || "dispatcher",
    });

    if (result.duplicate) {
      return res.status(409).json({
        message: "Duplicate job detected",
        job: serializeJob(result.job),
      });
    }

    res.status(201).json({ job: serializeJob(result.job) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/jobs/:id", async (req, res) => {
  try {
    const job = await getJobByIdOrThrow(req.params.id);
    const assignments = await Assignment.findAll({
      where: { jobId: job.id },
      order: [["createdAt", "DESC"]],
    });
    const history = await JobEvent.findAll({
      where: { jobId: job.id },
      order: [["eventTimestamp", "ASC"]],
    });

    const serializedHistory = history.map(serializeEvent);
    const manualQueueReason = [...serializedHistory]
      .reverse()
      .find((event) => event.details?.reason)?.details.reason;

    res.json({
      job: {
        ...serializeJob(job),
        manual_queue_reason: manualQueueReason || null,
      },
      assignments: assignments.map(serializeAssignment),
      history: serializedHistory,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get("/api/jobs/:id/history", async (req, res) => {
  try {
    const job = await getJobByIdOrThrow(req.params.id);
    const history = await JobEvent.findAll({
      where: { jobId: job.id },
      order: [["eventTimestamp", "ASC"]],
    });
    res.json({ history: history.map(serializeEvent) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get("/api/jobs/:id/recommendations", async (req, res) => {
  try {
    const job = await getJobByIdOrThrow(req.params.id);
    const riders = await Rider.findAll({ order: [["name", "ASC"]] });
    const recommendations = computeRecommendations(
      serializeJob(job),
      riders.map(serializeRider),
    );

    res.json({
      jobId: job.id,
      recommendations: recommendations.map(
        ({ rider, score, reasons, travelMinutes }) => ({
          rider: serializeRider(rider),
          score,
          reasons,
          travel_minutes: travelMinutes,
        }),
      ),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post("/api/jobs/:id/assign", async (req, res) => {
  try {
    const result = await assignRiderToJob(req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post("/api/jobs/:id/confirm", async (req, res) => {
  try {
    const result = await confirmAssignment(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    const statusCode = error.message.includes("available delivery capacity")
      ? 409
      : error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

app.post("/api/jobs/:id/manual-queue", async (req, res) => {
  try {
    const { reason = "Awaiting manual intervention", actor = "dispatcher" } =
      req.body;
    const job = await getJobByIdOrThrow(req.params.id);
    validateStatusTransition(job.status, "MANUAL_QUEUE");
    await job.update({ status: "MANUAL_QUEUE" });
    await recordJobEvent(
      job.id,
      "MOVED_TO_MANUAL_QUEUE",
      { reason },
      actor,
    );
    res.json({ ok: true, job: serializeJob(await getJobByIdOrThrow(job.id)) });
  } catch (error) {
    if (error.message.includes("Invalid status transition")) {
      return res.status(409).json({ message: error.message });
    }
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post("/api/jobs/:id/status", async (req, res) => {
  const transaction = await sequelize.transaction();
  let updatedRider = null;
  try {
    const { status, actor = "dispatcher" } = req.body;
    const job = await Job.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!job) {
      const error = new Error("Job not found");
      error.statusCode = 404;
      throw error;
    }
    validateStatusTransition(job.status, status);
    if (status === "CANCELLED" && job.status === "AWAITING_CONFIRMATION") {
      const pending = await Assignment.findOne({
        where: { jobId: job.id, status: "PENDING" },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (pending) {
        await pending.update(
          { status: "REJECTED", rejectedAt: new Date() },
          { transaction },
        );
        const rider = await Rider.findByPk(pending.riderId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (rider) {
          await releaseReservedCapacity(job, rider, "Job cancelled", actor, {
            transaction,
          });
          updatedRider = rider;
        }
      }
    }
    if (
      ["DELIVERED", "CANCELLED"].includes(status) &&
      ["ACCEPTED", "PICKED_UP"].includes(job.status) &&
      job.assignedRiderId
    ) {
      const rider = await Rider.findByPk(job.assignedRiderId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (rider) {
        await releaseReservedCapacity(
          job,
          rider,
          status === "DELIVERED" ? "Delivery completed" : "Job cancelled",
          actor,
          { transaction },
        );
        updatedRider = rider;
      }
    }
    const updatedJob = await updateJobStatus(job.id, status, actor, {
      transaction,
    });
    await transaction.commit();
    res.json({
      ok: true,
      job: serializeJob(updatedJob),
      rider: serializeRider(updatedRider ? await Rider.findByPk(updatedRider.id) : null),
    });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error.message.includes("Invalid status transition")) {
      return res.status(409).json({ message: error.message });
    }
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.post("/api/jobs/:id/timeout", async (req, res) => {
  try {
    const { actor = "system", force = true } = req.body;
    const result = await timeoutAssignment(req.params.id, actor, force);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Something went wrong" });
});

async function startServer() {
  try {
    await initializeDatabase();
    const sweepMs = Math.min(
      Math.max(getAssignmentTimeoutMinutes() * 60 * 1000, 5000),
      30000,
    );
    setInterval(() => {
      processExpiredAssignments().catch((error) =>
        console.error("Timeout sweep failed:", error.message),
      );
    }, sweepMs);
    app.listen(PORT, () => {
      console.log(`Project RELAY server listening on http://localhost:${PORT}`);
      console.log(
        `Assignment timeout is ${getAssignmentTimeoutMinutes()} minutes; overdue assignments are swept automatically.`,
      );
    });
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, sequelize };
