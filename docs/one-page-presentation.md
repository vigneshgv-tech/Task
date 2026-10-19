# Project RELAY — one-page summary

## Operational problem

Dispatchers spend too much time checking rider availability, chasing confirmations, and recovering jobs that sit idle. Missed acknowledgements and duplicate submissions make the queue unreliable.

## Proposed solution

Project RELAY is a dispatch desk that takes a job from intake to delivery: ranked rider recommendations, explicit assign/override, confirmation with a configurable timeout, automatic Manual Queue recovery, and an audit trail that matches the UI.

## Dispatcher workflow

1. See workload counts and jobs that need attention.
2. Search or filter jobs, then open one job with state and history.
3. Review eligible riders (zones, capacity, workload, simulated travel, deadline).
4. Assign the recommended rider or override with a reason.
5. If the rider never confirms, the job appears in the Manual Queue with the timeout recorded.
6. Reassign and complete pickup/delivery, or cancel.

## Rider workflow

1. Open assigned deliveries.
2. Accept or decline within the confirmation window.
3. Mark picked up, then delivered. Decline or timeout returns the job to dispatch without losing history.

## Recommendations and automatic queue handling

Eligible riders must cover pickup and delivery, be available, and have capacity. Ranking explains why one rider sits above another. No eligible rider → unassigned + Manual Queue. Assignment reserves capacity; reject/timeout/cancel/deliver releases it. Default timeout is two hours and is configurable; overdue pending assignments are swept automatically.

## Architecture and data model

React workspaces → Express services → PostgreSQL. A **job** is the order. An **assignment** is one confirmation attempt. **job_history** is the source of truth for what happened.

## Important trade-off

A single-node, testable workflow over a distributed event platform. That keeps the 8–12 hour build reviewable while still covering concurrency, duplicates, timeouts, and invalid state changes.

## If I had another week

Background timeout workers, a real ETA model, and stricter role-based controls with SLA monitoring.
