# API documentation

## Base URL

- Local: `http://localhost:8000`

## Health and config

### GET /health

Returns service health.

```json
{ "ok": true, "service": "relay-server" }
```

### GET /api/config

Returns the active confirmation window.

```json
{ "assignment_timeout_minutes": 2 }
```

The default is 2 minutes (two hours). Override with `ASSIGNMENT_TIMEOUT_MINUTES`. The server also sweeps overdue pending assignments automatically.

## Dashboard

### GET /api/dashboard

Returns aggregated dashboard metrics:

- `total_jobs`
- `waiting_assignment` (`NEW` and `READY_FOR_ASSIGNMENT`)
- `awaiting_confirmation`
- `in_progress` (`ACCEPTED` and `PICKED_UP`)
- `manual_queue`
- `completed`
- `cancelled`

## Accounts

### POST /api/auth/register

Creates a dispatcher or rider account. Rider registration also creates a rider profile.

### POST /api/auth/login

Returns the account plus a signed session token. Invalid credentials return `401`.

### GET /api/auth/session

Restores the account from `Authorization: Bearer <token>`.

### GET /api/master-records/zone

Returns active zone records used by job and rider forms.

## Riders

### GET /api/riders

Returns the rider roster with identity, supported zones, availability, capacity, and workload.

### GET /api/riders/:id

Returns a single rider.

### POST /api/riders

Creates a rider.

```json
{
  "name": "Rider Six",
  "current_zone": "north",
  "supported_zones": ["north", "central"],
  "total_capacity": 12
}
```

### PATCH /api/riders/:id

Updates availability, workload, capacity, current zone, or supported zones.

## Jobs

### GET /api/jobs

Query parameters:

- `status`: filter by job status
- `zone`: filter by pickup or delivery zone
- `search`: search by order / job reference

### GET /api/manual-queue

Lists jobs that require dispatcher intervention, including the latest queue reason.

### POST /api/jobs

Creates a delivery job. Duplicate payloads (same pickup, delivery, load, priority, and deadline) return `409`.

```json
{
  "pickup_zone": "north",
  "delivery_zone": "central",
  "load_capacity": 6,
  "priority": "HIGH",
  "deadline": "2026-10-19T18:00:00Z"
}
```

A new job is recorded as `NEW`, moved to `READY_FOR_ASSIGNMENT`, and sent to `MANUAL_QUEUE` if no eligible rider exists.

### GET /api/jobs/:id

Returns a job, assignment attempts, timeline history, and `manual_queue_reason` when present.

### GET /api/jobs/:id/history

Returns chronological operational events.

### GET /api/jobs/:id/recommendations

Returns eligible riders with score, reasons, and simulated travel minutes.

Ranking uses:

- pickup/delivery zone coverage
- availability and remaining capacity
- current workload
- simulated zone travel time
- priority and proximity to the deadline

### POST /api/jobs/:id/assign

Assigns an eligible rider. Capacity is reserved immediately. A second dispatcher attempting the same job receives `409`. Choosing a rider other than the top recommendation requires `override_reason`.

```json
{
  "rider_id": 1,
  "actor": "dispatcher",
  "override_reason": "Rider is closest to pickup area"
}
```

### POST /api/jobs/:id/confirm

Accepts or rejects a pending assignment.

```json
{
  "action": "ACCEPT",
  "actor": "rider-42"
}
```

- `ACCEPT` — job becomes `ACCEPTED`; reserved capacity stays with the rider.
- `REJECT` — assignment is kept in history, capacity is released, job moves to `MANUAL_QUEUE`.

### POST /api/jobs/:id/manual-queue

Moves a job that is still in a valid pre-queue state into the Manual Queue.

```json
{
  "reason": "Dispatcher review required",
  "actor": "dispatcher"
}
```

### POST /api/jobs/:id/status

Updates status with transition validation.

```json
{
  "status": "PICKED_UP",
  "actor": "dispatcher"
}
```

Allowed path after accept: `ACCEPTED` → `PICKED_UP` → `DELIVERED`. `CANCELLED` is allowed from active states but not from `DELIVERED`. Cancelling a pending assignment releases reserved capacity.

### POST /api/jobs/:id/timeout

Times out the pending assignment. `force: true` (default on this endpoint) replays timeout immediately for demos. Automatic sweeps only expire assignments whose confirmation deadline has passed.

```json
{ "actor": "system", "force": true }
```

Effects:

- job status becomes `MANUAL_QUEUE`
- reason is recorded
- the expired assignment remains in history
- reserved rider capacity is released
- the job can be assigned again

## Error handling

The API returns meaningful errors for invalid payloads, duplicate jobs, missing records, conflicting assignments, ineligible riders, and invalid transitions.

```json
{
  "message": "Invalid status transition from ACCEPTED to DELIVERED"
}
```

Common status codes:

- `400` invalid input or ineligible rider
- `401` authentication failure
- `404` missing job or rider
- `409` duplicate job, conflicting assignment, or illegal status change
