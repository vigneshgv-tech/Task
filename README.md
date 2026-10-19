# Project RELAY

Project RELAY is a dispatch desk for delivery operations. Dispatchers create jobs, review ranked rider recommendations, assign or override riders, and recover stuck work from the Manual Queue. Riders confirm assignments and move jobs through pickup and delivery. Timed-out confirmations are moved to the Manual Queue automatically and keep a full audit trail.

## Architecture

- Frontend: React + Vite dashboards for dispatchers and riders
- Backend: Node.js + Express API with service-layer assignment, recommendation, and timeout rules
- Database: PostgreSQL for jobs, riders, assignments, and `job_history`
- Container: Docker Compose for a local Postgres instance

## Folder layout

```text
.
├── client/                 # React dashboard
├── server/                 # Express API and business rules
├── docs/                   # API, design, engineering notes, one-page summary
├── docker-compose.yml      # Postgres runtime
├── .env.example            # Local environment template
└── README.md
```

## Prerequisites

- Node.js 18+
- npm 9+ and Yarn
- Docker Desktop or Docker Engine

## Local setup

1. Start Postgres:

```bash
docker compose up -d
```

2. Copy the environment template. The default confirmation window is **2 minutes** (two hours). For a review session, set it to `2` so timeout behavior is easy to observe:

```bash
cp .env.example .env
```

```bash
ASSIGNMENT_TIMEOUT_MINUTES=2
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/relay
```

3. Install and start the API:

```bash
cd server
npm install
npm run dev
```

4. Install and start the UI:

```bash
cd client
yarn install
yarn dev
```

5. Open the UI at http://localhost:5173 and the API at http://localhost:8000/health.

On first boot the API seeds zones, five sample riders, two sample jobs (`REL-DEMO-READY`, `REL-DEMO-MANUAL`), and demo accounts. You do not need to edit the database by hand.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Dispatcher | `dispatcher@relay.test` | `RelayDemo123!` |
| Rider (Rider One) | `rider@relay.test` | `RelayDemo123!` |

You can also register a new dispatcher or rider from the sign-in screen.

## Demonstration scenario

This walkthrough covers the assignment completion criteria.

1. Sign in as `dispatcher@relay.test`.
2. Confirm dashboard counts: total jobs, awaiting assignment, awaiting rider confirmation, in progress, Manual Queue, completed, cancelled.
3. Open `REL-DEMO-READY`, or create a job (north → central, load 6, high priority, optional deadline). Search by order ID and filter by status or zone.
4. Review ranked recommendations (zone coverage, capacity, workload, simulated travel time, priority/deadline). Assign the top rider, or choose another eligible rider and enter an override reason.
5. Sign in as `rider@relay.test` and accept the assignment, **or** stay on the dispatcher job and use **Accept assignment** / **Reject assignment**.
6. After accept, mark picked up and delivered. Capacity is released on delivery.
7. Create another assignment and click **Simulate timeout** (or wait for `ASSIGNMENT_TIMEOUT_MINUTES`). The job moves to the Manual Queue, the expired assignment stays in history, reserved capacity is released, and the job can be reassigned.
8. Open the Manual Queue, inspect the reason and timeline, then assign a different eligible rider and complete delivery.
9. Resubmit the same job payload to confirm the API returns `409 Duplicate job detected`.

The job timeline should match the UI: creation, recommendation, assignment, confirm/reject/timeout, Manual Queue, reassignment, pickup, delivery, or cancel.

## Test commands

```bash
cd server
npm test
```

Covered business behavior:

1. A job is recommended/assigned only to an eligible rider.
2. Unavailable riders and riders without capacity are excluded.
3. A job with no eligible rider stays available for manual intervention (Manual Queue).
4. A confirmed assignment can move NEW → READY → AWAITING_CONFIRMATION → ACCEPTED → PICKED_UP → DELIVERED.
5. An overdue assignment is detected after the configured threshold.
6. Timing out an assignment releases reserved capacity and keeps history.
7. Duplicate payloads hash to the same job and do not create a second record.
8. Invalid status transitions and conflicting assignment attempts are rejected.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `8000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `CLIENT_URL` | Vite origin |
| `ASSIGNMENT_TIMEOUT_MINUTES` | Rider confirmation window. Default **2**. Use `2` for demos. |
| `AUTH_TOKEN_SECRET` | Signed session token secret |

The server also sweeps pending assignments whose confirmation deadline has passed, so reviewers do not need to click Simulate timeout if the window has already expired.

## Documentation

- [API documentation](docs/api.md)
- [System design](docs/system-design.md)
- [Engineering notes](docs/engineering-notes.md)
- [One-page solution summary](docs/one-page-presentation.md)

## Assumptions and limitations

- Riders, zones, and travel times are simulated. There is no live GPS feed.
- Capacity is reserved when a rider is assigned and released on reject, timeout, cancel, or delivery.
- Duplicate detection uses a stable hash of pickup, delivery, load, priority, and deadline.
- Auth is a signed local session, not a production identity provider.
- Timeout processing runs in-process. A dedicated worker would be the next step at higher volume.
