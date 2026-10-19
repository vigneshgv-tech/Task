const {
  computeRecommendations,
  validateStatusTransition,
  createDuplicateHash,
  assertJobAssignable,
  isAssignmentOverdue,
  getEstimatedTravelMinutes,
} = require("../src/services/dispatchService");
const {
  hashPassword,
  verifyPassword,
  createSessionToken,
  getUserFromSessionToken,
} = require("../src/services/authService");
const {
  reserveDeliveryCapacity,
  releaseDeliveryCapacity,
} = require("../src/services/riderCapacityService");
const { User } = require("../src/models");

describe("Project RELAY dispatch service", () => {
  test("assigns a job to an eligible rider", () => {
    const riders = [
      {
        id: "r1",
        name: "Rider One",
        current_zone: "north",
        service_zones: ["north", "central"],
        capacity: 20,
        availability: "AVAILABLE",
        current_workload: 2,
      },
      {
        id: "r2",
        name: "Rider Two",
        current_zone: "south",
        service_zones: ["south"],
        capacity: 12,
        availability: "AVAILABLE",
        current_workload: 5,
      },
    ];

    const job = {
      id: "job-1",
      pickup_zone: "north",
      delivery_zone: "central",
      priority: "HIGH",
      load_capacity: 6,
      deadline: "2026-10-18T18:00:00Z",
    };

    const recommendations = computeRecommendations(job, riders);
    expect(recommendations.some((r) => r.rider.id === "r1")).toBe(true);
    expect(recommendations[0].rider.id).toBe("r1");
  });

  test("excludes unavailable riders and low-capacity riders", () => {
    const riders = [
      {
        id: "r1",
        name: "Rider One",
        current_zone: "north",
        service_zones: ["north"],
        capacity: 2,
        availability: "UNAVAILABLE",
        current_workload: 1,
      },
      {
        id: "r2",
        name: "Rider Two",
        current_zone: "north",
        service_zones: ["north"],
        capacity: 6,
        availability: "AVAILABLE",
        current_workload: 9,
      },
      {
        id: "r3",
        name: "Rider Three",
        current_zone: "north",
        service_zones: ["north"],
        capacity: 8,
        availability: "AVAILABLE",
        current_workload: 2,
      },
    ];

    const job = {
      id: "job-2",
      pickup_zone: "north",
      delivery_zone: "north",
      priority: "MEDIUM",
      load_capacity: 6,
      deadline: "2026-10-18T17:00:00Z",
    };

    const recommendations = computeRecommendations(job, riders);
    expect(recommendations.map((r) => r.rider.id)).toEqual(["r3"]);
  });

  test("supports riders with table-backed service zones", () => {
    const riders = [
      {
        id: "r1",
        name: "Rider One",
        rider_reference: "RDR-001",
        current_zone: "north",
        supported_zones: ["north", "central"],
        total_capacity: 20,
        available_capacity: 8,
        availability_status: "AVAILABLE",
        current_workload: 2,
      },
      {
        id: "r2",
        current_zone: "north",
        supported_zones: ["north"],
        total_capacity: 20,
        available_capacity: 20,
        availability_status: "AVAILABLE",
        current_workload: 0,
      },
      {
        id: "r3",
        current_zone: "north",
        supported_zones: ["north", "central"],
        total_capacity: 20,
        available_capacity: 20,
        availability_status: "UNAVAILABLE",
        current_workload: 0,
      },
      {
        id: "r4",
        current_zone: "north",
        supported_zones: ["north", "central"],
        total_capacity: 20,
        available_capacity: 5,
        availability_status: "AVAILABLE",
        current_workload: 0,
      },
      {
        id: "r5",
        current_zone: "north",
        supported_zones: ["north", "central"],
        total_capacity: 8,
        available_capacity: 8,
        availability_status: "AVAILABLE",
        current_workload: 3,
      },
      {
        id: "r6",
        current_zone: "north",
        supported_zones: [],
        total_capacity: 20,
        available_capacity: 20,
        availability_status: "AVAILABLE",
        current_workload: 0,
      },
      {
        id: "r7",
        current_zone: "south",
        supported_zones: ["central"],
        total_capacity: 20,
        available_capacity: 20,
        availability_status: "AVAILABLE",
        current_workload: 0,
      },
    ];
    const job = {
      id: "job-current-zone",
      pickup_zone: "north",
      delivery_zone: "central",
      priority: "HIGH",
      load_capacity: 6,
    };

    const recommendations = computeRecommendations(job, riders);
    expect(recommendations.map((entry) => entry.rider.id)).toEqual(["r1"]);
  });

  test("reserves accepted load and releases it when a delivery completes", () => {
    const rider = {
      totalCapacity: 10,
      availableCapacity: 6,
      currentWorkload: 4,
    };
    const reserved = reserveDeliveryCapacity(rider, 6);
    expect(reserved).toEqual({ availableCapacity: 0, currentWorkload: 10 });

    const unavailableRider = {
      id: "rider-at-capacity",
      current_zone: "north",
      supported_zones: ["south"],
      availability_status: "AVAILABLE",
      total_capacity: 10,
      available_capacity: reserved.availableCapacity,
      current_workload: reserved.currentWorkload,
    };
    const job = {
      pickup_zone: "north",
      delivery_zone: "south",
      load_capacity: 2,
      priority: "MEDIUM",
    };
    expect(computeRecommendations(job, [unavailableRider])).toEqual([]);

    expect(releaseDeliveryCapacity({ ...rider, ...reserved }, 6)).toEqual({
      availableCapacity: 6,
      currentWorkload: 4,
    });
  });

  test("refuses to reserve more capacity than the rider has available", () => {
    expect(() =>
      reserveDeliveryCapacity(
        { totalCapacity: 10, availableCapacity: 2, currentWorkload: 8 },
        3,
      ),
    ).toThrow("Rider does not have enough available delivery capacity");
  });

  test("hashes passwords with a salt and rejects an incorrect password", async () => {
    const { salt, hash } = await hashPassword("relay-pass-123");
    expect(hash).not.toBe("relay-pass-123");
    await expect(verifyPassword("relay-pass-123", salt, hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("incorrect", salt, hash)).resolves.toBe(false);
  });

  test("rejects tampered persistent session tokens", async () => {
    const token = createSessionToken({ id: 42 });
    await expect(
      getUserFromSessionToken(`${token}tampered`),
    ).resolves.toBeNull();
  });

  test("restores the database user from a valid session token", async () => {
    const userLookup = jest.spyOn(User, "findByPk").mockResolvedValue({
      id: 42,
      name: "Rider Test",
      email: "rider-test@example.test",
      role: "rider",
      riderId: 7,
    });
    try {
      const sessionUser = await getUserFromSessionToken(
        createSessionToken({ id: 42 }),
      );
      expect(sessionUser).toEqual({
        id: 42,
        name: "Rider Test",
        email: "rider-test@example.test",
        role: "rider",
        rider_id: 7,
      });
    } finally {
      userLookup.mockRestore();
    }
  });

  test("keeps a job available for manual intervention when no eligible rider exists", () => {
    const riders = [
      {
        id: "r1",
        name: "Rider One",
        current_zone: "south",
        service_zones: ["south"],
        capacity: 10,
        availability: "AVAILABLE",
        current_workload: 1,
      },
      {
        id: "r2",
        name: "Rider Two",
        current_zone: "west",
        service_zones: ["west"],
        capacity: 10,
        availability: "AVAILABLE",
        current_workload: 1,
      },
    ];

    const job = {
      id: "job-3",
      pickup_zone: "north",
      delivery_zone: "central",
      priority: "HIGH",
      load_capacity: 14,
      deadline: "2026-10-18T16:00:00Z",
    };

    const recommendations = computeRecommendations(job, riders);
    expect(recommendations).toEqual([]);
  });

  test("validates invalid status transitions", () => {
    expect(() => validateStatusTransition("DELIVERED", "PICKED_UP")).toThrow();
    expect(() => validateStatusTransition("CANCELLED", "PICKED_UP")).toThrow();
    expect(() =>
      validateStatusTransition("PICKED_UP", "DELIVERED"),
    ).not.toThrow();
  });

  test("generates a stable duplicate hash for the same job payload", () => {
    const payload = {
      pickup_zone: "north",
      delivery_zone: "central",
      priority: "HIGH",
      load_capacity: 6,
      deadline: "2026-10-18T18:00:00Z",
    };

    expect(createDuplicateHash(payload)).toBe(createDuplicateHash(payload));
    expect(createDuplicateHash(payload)).not.toBe(
      createDuplicateHash({ ...payload, load_capacity: 8 }),
    );
  });

  test("lets a confirmed assignment proceed through the delivery lifecycle", () => {
    expect(() =>
      validateStatusTransition("NEW", "READY_FOR_ASSIGNMENT"),
    ).not.toThrow();
    expect(() =>
      validateStatusTransition("READY_FOR_ASSIGNMENT", "AWAITING_CONFIRMATION"),
    ).not.toThrow();
    expect(() =>
      validateStatusTransition("AWAITING_CONFIRMATION", "ACCEPTED"),
    ).not.toThrow();
    expect(() => validateStatusTransition("ACCEPTED", "PICKED_UP")).not.toThrow();
    expect(() =>
      validateStatusTransition("PICKED_UP", "DELIVERED"),
    ).not.toThrow();
    expect(() =>
      validateStatusTransition("AWAITING_CONFIRMATION", "DELIVERED"),
    ).toThrow();
  });

  test("marks an assignment overdue after the configured confirmation threshold", () => {
    const assignment = {
      status: "PENDING",
      responseDeadline: "2026-10-19T01:00:00Z",
    };
    expect(
      isAssignmentOverdue(assignment, new Date("2026-10-19T03:05:00Z")),
    ).toBe(true);
    expect(
      isAssignmentOverdue(assignment, new Date("2026-10-19T00:30:00Z")),
    ).toBe(false);
  });

  test("releases reserved capacity when a timed-out assignment is reversed", () => {
    const rider = {
      totalCapacity: 12,
      availableCapacity: 12,
      currentWorkload: 0,
    };
    const reserved = reserveDeliveryCapacity(rider, 4);
    expect(reserved).toEqual({ availableCapacity: 8, currentWorkload: 4 });
    expect(releaseDeliveryCapacity({ ...rider, ...reserved }, 4)).toEqual({
      availableCapacity: 12,
      currentWorkload: 0,
    });
  });

  test("rejects conflicting assignment attempts", () => {
    expect(() =>
      assertJobAssignable({ status: "AWAITING_CONFIRMATION" }, null),
    ).toThrow(/pending assignment|ready for assignment|manual queue/i);
    expect(() =>
      assertJobAssignable(
        { status: "READY_FOR_ASSIGNMENT" },
        { id: 9, status: "PENDING" },
      ),
    ).toThrow(/already has a pending assignment/i);
    expect(
      assertJobAssignable({ status: "MANUAL_QUEUE" }, null),
    ).toBe(true);
  });

  test("includes simulated travel time when ranking eligible riders", () => {
    const riders = [
      {
        id: "busy",
        current_zone: "north",
        supported_zones: ["central"],
        availability_status: "AVAILABLE",
        total_capacity: 20,
        available_capacity: 12,
        current_workload: 8,
      },
      {
        id: "open",
        current_zone: "north",
        supported_zones: ["central"],
        availability_status: "AVAILABLE",
        total_capacity: 20,
        available_capacity: 20,
        current_workload: 0,
      },
    ];
    const job = {
      pickup_zone: "north",
      delivery_zone: "central",
      load_capacity: 2,
      priority: "MEDIUM",
    };
    const recommendations = computeRecommendations(job, riders);
    expect(recommendations[0].rider.id).toBe("open");
    expect(recommendations[0].travelMinutes).toBe(
      getEstimatedTravelMinutes("north", "central"),
    );
  });
});
