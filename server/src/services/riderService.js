const { Rider } = require("../models");

async function listRiders() {
  return Rider.findAll({ order: [["name", "ASC"]] });
}

async function getRiderById(id) {
  return Rider.findByPk(id);
}

async function createRider(payload, options = {}) {
  return Rider.create(
    {
      riderReference: payload.riderReference || `RDR-${Date.now()}`,
      name: payload.name,
      currentZone: payload.currentZone || payload.current_zone || "central",
      supportedZones: payload.supportedZones || payload.supported_zones || [],
      totalCapacity: Number(
        payload.totalCapacity ?? payload.total_capacity ?? 0,
      ),
      availableCapacity: Number(
        payload.availableCapacity ??
          payload.available_capacity ??
          payload.totalCapacity ??
          payload.total_capacity ??
          0,
      ),
      availabilityStatus:
        payload.availabilityStatus ||
        payload.availability_status ||
        payload.availability ||
        "AVAILABLE",
      currentWorkload: Number(
        payload.currentWorkload ?? payload.current_workload ?? 0,
      ),
    },
    options,
  );
}

async function updateRider(id, payload) {
  const rider = await Rider.findByPk(id);
  if (!rider) return null;

  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.currentZone !== undefined || payload.current_zone !== undefined) {
    updates.currentZone = payload.currentZone ?? payload.current_zone;
  }
  if (
    payload.supportedZones !== undefined ||
    payload.supported_zones !== undefined
  ) {
    updates.supportedZones = payload.supportedZones ?? payload.supported_zones;
  }
  if (
    payload.totalCapacity !== undefined ||
    payload.total_capacity !== undefined
  ) {
    updates.totalCapacity = Number(
      payload.totalCapacity ?? payload.total_capacity,
    );
  }
  if (
    payload.availableCapacity !== undefined ||
    payload.available_capacity !== undefined
  ) {
    updates.availableCapacity = Number(
      payload.availableCapacity ?? payload.available_capacity,
    );
  }
  if (
    payload.availabilityStatus !== undefined ||
    payload.availability_status !== undefined ||
    payload.availability !== undefined
  ) {
    updates.availabilityStatus =
      payload.availabilityStatus ??
      payload.availability_status ??
      payload.availability;
  }
  if (
    payload.currentWorkload !== undefined ||
    payload.current_workload !== undefined
  ) {
    updates.currentWorkload = Number(
      payload.currentWorkload ?? payload.current_workload,
    );
  }

  const totalCapacity = Number(updates.totalCapacity ?? rider.totalCapacity);
  const currentWorkload = Number(
    updates.currentWorkload ?? rider.currentWorkload,
  );
  const availableCapacity = Number(
    updates.availableCapacity ?? rider.availableCapacity,
  );
  if (
    !Number.isFinite(totalCapacity) ||
    !Number.isFinite(currentWorkload) ||
    !Number.isFinite(availableCapacity) ||
    totalCapacity < 0 ||
    currentWorkload < 0 ||
    availableCapacity < 0 ||
    currentWorkload > totalCapacity ||
    availableCapacity > totalCapacity - currentWorkload
  ) {
    throw Object.assign(
      new Error(
        "Available capacity must be between zero and defined capacity minus current workload",
      ),
      { statusCode: 400 },
    );
  }

  await rider.update(updates);
  return rider;
}

module.exports = {
  listRiders,
  getRiderById,
  createRider,
  updateRider,
};
