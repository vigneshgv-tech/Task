function reserveDeliveryCapacity(rider, load) {
  const capacityLoad = Number(load);
  const totalCapacity = Number(
    rider.totalCapacity ?? rider.total_capacity ?? 0,
  );
  const availableCapacity = Number(
    rider.availableCapacity ?? rider.available_capacity ?? 0,
  );
  const currentWorkload = Number(
    rider.currentWorkload ?? rider.current_workload ?? 0,
  );

  if (!Number.isFinite(capacityLoad) || capacityLoad <= 0) {
    throw new Error("Job load must be a positive number");
  }
  if (
    availableCapacity < capacityLoad ||
    currentWorkload + capacityLoad > totalCapacity
  ) {
    throw new Error("Rider does not have enough available delivery capacity");
  }

  return {
    availableCapacity: availableCapacity - capacityLoad,
    currentWorkload: currentWorkload + capacityLoad,
  };
}

function releaseDeliveryCapacity(rider, load) {
  const capacityLoad = Number(load);
  const totalCapacity = Number(
    rider.totalCapacity ?? rider.total_capacity ?? 0,
  );
  const availableCapacity = Number(
    rider.availableCapacity ?? rider.available_capacity ?? 0,
  );
  const currentWorkload = Number(
    rider.currentWorkload ?? rider.current_workload ?? 0,
  );

  if (!Number.isFinite(capacityLoad) || capacityLoad <= 0) {
    throw new Error("Job load must be a positive number");
  }

  const releasedLoad = Math.min(capacityLoad, currentWorkload);
  return {
    availableCapacity: Math.min(
      totalCapacity,
      availableCapacity + releasedLoad,
    ),
    currentWorkload: Math.max(0, currentWorkload - releasedLoad),
  };
}

module.exports = { reserveDeliveryCapacity, releaseDeliveryCapacity };
