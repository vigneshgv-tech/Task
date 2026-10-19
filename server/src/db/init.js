const { sequelize, Rider, Job, User } = require("../models");
const { ensureMasterRecords } = require("../services/masterDataService");
const { hashPassword } = require("../services/authService");
const { createDuplicateHash } = require("../services/dispatchService");
const { DataTypes } = require("sequelize");

async function getTableColumns(queryInterface, tableName) {
  const [rows] = await sequelize.query(
    "SELECT to_regclass(:tableName) AS table_name",
    { replacements: { tableName: `public.${tableName}` } },
  );
  if (!rows[0]?.table_name) return null;
  return queryInterface.describeTable(tableName);
}

async function migrateLegacySchema() {
  const queryInterface = sequelize.getQueryInterface();
  const renameColumn = async (tableName, columns, oldName, newName) => {
    if (columns[oldName] && !columns[newName]) {
      await queryInterface.renameColumn(tableName, oldName, newName);
      columns[newName] = columns[oldName];
      delete columns[oldName];
    }
  };

  const riderColumns = await getTableColumns(queryInterface, "riders");
  if (riderColumns) {
    await renameColumn("riders", riderColumns, "capacity", "total_capacity");
    await renameColumn(
      "riders",
      riderColumns,
      "availability",
      "availability_status",
    );
    if (!riderColumns.rider_reference) {
      await queryInterface.addColumn("riders", "rider_reference", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      riderColumns.rider_reference = true;
    }
    if (!riderColumns.available_capacity) {
      await queryInterface.addColumn("riders", "available_capacity", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      riderColumns.available_capacity = true;
    }
    if (!riderColumns.current_zone) {
      await queryInterface.addColumn("riders", "current_zone", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      riderColumns.current_zone = true;
    }
    if (!riderColumns.supported_zones) {
      await queryInterface.addColumn("riders", "supported_zones", {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      });
      riderColumns.supported_zones = true;
    }
    const zoneFallback = riderColumns.service_zones
      ? "service_zones[1]"
      : "'central'";
    const supportedZonesFallback = riderColumns.service_zones
      ? "COALESCE(service_zones, ARRAY[COALESCE(current_zone, 'central')])"
      : "ARRAY[COALESCE(current_zone, 'central')]";
    await sequelize.query(
      `UPDATE riders
       SET rider_reference = COALESCE(rider_reference, 'RDR-' || LPAD(id::text, 6, '0')),
           available_capacity = COALESCE(available_capacity, GREATEST(total_capacity - COALESCE(current_workload, 0), 0)),
           current_zone = COALESCE(current_zone, ${zoneFallback}, 'central'),
           supported_zones = COALESCE(supported_zones, ${supportedZonesFallback})`,
    );
    for (const [columnName, type] of [
      ["rider_reference", DataTypes.STRING(100)],
      ["available_capacity", DataTypes.INTEGER],
      ["current_zone", DataTypes.STRING(100)],
      ["supported_zones", DataTypes.ARRAY(DataTypes.STRING)],
    ]) {
      await queryInterface.changeColumn("riders", columnName, {
        type,
        allowNull: false,
      });
    }
    if (riderColumns.service_zones) {
      await queryInterface.removeColumn("riders", "service_zones");
    }
  }

  const jobColumns = await getTableColumns(queryInterface, "jobs");
  if (jobColumns) {
    await renameColumn("jobs", jobColumns, "job_reference", "order_reference");
    await renameColumn("jobs", jobColumns, "deadline", "delivery_deadline");
    await renameColumn("jobs", jobColumns, "status", "current_status");
    await sequelize.query(
      "ALTER TABLE jobs ALTER COLUMN delivery_deadline SET DEFAULT NOW()",
    );
    await sequelize.query(
      "UPDATE jobs SET delivery_deadline = NOW() WHERE delivery_deadline IS NULL",
    );
    await queryInterface.changeColumn("jobs", "delivery_deadline", {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal("NOW()"),
    });
    if (!jobColumns.updated_at) {
      await queryInterface.addColumn("jobs", "updated_at", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      await sequelize.query(
        "UPDATE jobs SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL",
      );
      await queryInterface.changeColumn("jobs", "updated_at", {
        type: DataTypes.DATE,
        allowNull: false,
      });
    }
    if (jobColumns.current_assignment_id) {
      await queryInterface.removeColumn("jobs", "current_assignment_id");
    }
    if (!jobColumns.duplicate_hash) {
      await queryInterface.addColumn("jobs", "duplicate_hash", {
        type: DataTypes.STRING(64),
        allowNull: true,
        unique: true,
      });
    }
  }

  const assignmentColumns = await getTableColumns(
    queryInterface,
    "assignments",
  );
  if (assignmentColumns) {
    await renameColumn(
      "assignments",
      assignmentColumns,
      "response_deadline",
      "confirmation_deadline",
    );
    await renameColumn(
      "assignments",
      assignmentColumns,
      "accepted_at",
      "confirmed_at",
    );
    await renameColumn(
      "assignments",
      assignmentColumns,
      "timed_out_at",
      "timeout_at",
    );
    if (!assignmentColumns.attempt_number) {
      await queryInterface.addColumn("assignments", "attempt_number", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      assignmentColumns.attempt_number = true;
    }
    if (!assignmentColumns.assigned_at) {
      await queryInterface.addColumn("assignments", "assigned_at", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      assignmentColumns.assigned_at = true;
    }
    await sequelize.query(
      `WITH attempts AS (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at, id) AS attempt_number
         FROM assignments
       )
       UPDATE assignments AS assignment
       SET attempt_number = COALESCE(assignment.attempt_number, attempts.attempt_number),
           assigned_at = COALESCE(assignment.assigned_at, assignment.created_at, NOW())
       FROM attempts
       WHERE assignment.id = attempts.id`,
    );
    await queryInterface.changeColumn("assignments", "attempt_number", {
      type: DataTypes.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn("assignments", "assigned_at", {
      type: DataTypes.DATE,
      allowNull: false,
    });
    if (assignmentColumns.override_reason) {
      await queryInterface.removeColumn("assignments", "override_reason");
    }
  }

  const oldHistoryColumns = await getTableColumns(queryInterface, "job_events");
  const newHistoryColumns = await getTableColumns(
    queryInterface,
    "job_history",
  );
  if (oldHistoryColumns && !newHistoryColumns) {
    await queryInterface.renameTable("job_events", "job_history");
  }
  const historyColumns =
    newHistoryColumns ||
    (oldHistoryColumns
      ? await getTableColumns(queryInterface, "job_history")
      : null);
  if (historyColumns) {
    await renameColumn("job_history", historyColumns, "actor", "actor_id");
    await renameColumn(
      "job_history",
      historyColumns,
      "created_at",
      "event_timestamp",
    );
    if (historyColumns.assignment_id) {
      await sequelize.query(
        `UPDATE job_history
         SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('assignment_id', assignment_id)
         WHERE assignment_id IS NOT NULL`,
      );
      await queryInterface.removeColumn("job_history", "assignment_id");
    }
    if (historyColumns.updated_at) {
      await queryInterface.removeColumn("job_history", "updated_at");
    }
    if (jobColumns?.manual_queue_reason) {
      await sequelize.query(
        `INSERT INTO job_history (job_id, event_type, event_timestamp, actor_id, details)
         SELECT id, 'QUEUE_REASON_MIGRATED', NOW(), 'migration',
                jsonb_build_object('reason', manual_queue_reason)
         FROM jobs
         WHERE manual_queue_reason IS NOT NULL`,
      );
      await queryInterface.removeColumn("jobs", "manual_queue_reason");
    }
  }

  const usersTable = await getTableColumns(queryInterface, "users");
  if (!usersTable) {
    await queryInterface.createTable("users", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      password_salt: { type: DataTypes.STRING(64), allowNull: false },
      role: { type: DataTypes.STRING(32), allowNull: false },
      rider_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        references: { model: "riders", key: "id" },
        onDelete: "SET NULL",
      },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    });
  }
}

async function initializeDatabase() {
  await sequelize.authenticate();
  await migrateLegacySchema();
  await sequelize.sync();
  await ensureMasterRecords();

  const riderCount = await Rider.count();
  if (riderCount === 0) {
    await Rider.bulkCreate([
      {
        riderReference: "RDR-001",
        name: "Rider One",
        currentZone: "north",
        supportedZones: ["north", "central"],
        totalCapacity: 20,
        availableCapacity: 18,
        availabilityStatus: "AVAILABLE",
        currentWorkload: 2,
      },
      {
        riderReference: "RDR-002",
        name: "Rider Two",
        currentZone: "south",
        supportedZones: ["south", "west"],
        totalCapacity: 14,
        availableCapacity: 10,
        availabilityStatus: "AVAILABLE",
        currentWorkload: 4,
      },
      {
        riderReference: "RDR-003",
        name: "Rider Three",
        currentZone: "north",
        supportedZones: ["north", "central", "east"],
        totalCapacity: 8,
        availableCapacity: 6,
        availabilityStatus: "AVAILABLE",
        currentWorkload: 2,
      },
      {
        riderReference: "RDR-004",
        name: "Rider Four",
        currentZone: "central",
        supportedZones: ["central", "south"],
        totalCapacity: 10,
        availableCapacity: 9,
        availabilityStatus: "UNAVAILABLE",
        currentWorkload: 1,
      },
      {
        riderReference: "RDR-005",
        name: "Rider Five",
        currentZone: "east",
        supportedZones: ["north", "east"],
        totalCapacity: 12,
        availableCapacity: 6,
        availabilityStatus: "AVAILABLE",
        currentWorkload: 6,
      },
    ]);
  }

  const userCount = await User.count();
  if (userCount === 0) {
    const dispatcherSecret = await hashPassword("RelayDemo123!");
    const riderSecret = await hashPassword("RelayDemo123!");
    const demoRider = await Rider.findOne({
      where: { riderReference: "RDR-001" },
    });
    await User.bulkCreate([
      {
        name: "Demo Dispatcher",
        email: "dispatcher@relay.test",
        passwordHash: dispatcherSecret.hash,
        passwordSalt: dispatcherSecret.salt,
        role: "dispatcher",
      },
      {
        name: "Demo Rider",
        email: "rider@relay.test",
        passwordHash: riderSecret.hash,
        passwordSalt: riderSecret.salt,
        role: "rider",
        riderId: demoRider?.id || null,
      },
    ]);
  }

  const jobCount = await Job.count();
  if (jobCount === 0) {
    const samples = [
      {
        jobReference: "REL-DEMO-READY",
        pickupZone: "north",
        deliveryZone: "central",
        loadCapacity: 6,
        priority: "HIGH",
        status: "READY_FOR_ASSIGNMENT",
      },
      {
        jobReference: "REL-DEMO-MANUAL",
        pickupZone: "west",
        deliveryZone: "east",
        loadCapacity: 4,
        priority: "URGENT",
        status: "MANUAL_QUEUE",
      },
    ];
    for (const sample of samples) {
      await Job.create({
        ...sample,
        deadline: new Date(Date.now() + 3 * 60 * 60 * 1000),
        duplicateHash: createDuplicateHash({
          pickup_zone: sample.pickupZone,
          delivery_zone: sample.deliveryZone,
          load_capacity: sample.loadCapacity,
          priority: sample.priority,
          deadline: "demo",
        }),
      });
    }
  }
}

module.exports = { initializeDatabase };
