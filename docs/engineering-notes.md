# Engineering notes

## Assumptions

- Riders, zones, and travel times are simulated. There is no live GPS integration.
- Rider confirmation is an in-app / API action, not a push notification.
- The product default confirmation window is two hours. Local `.env` may use `ASSIGNMENT_TIMEOUT_MINUTES=2` so reviewers can see timeout behavior quickly.
- Jobs without an eligible rider are left unassigned and moved to the Manual Queue rather than staying hidden in `READY_FOR_ASSIGNMENT`.
- Capacity is reserved at assignment time so a pending job counts against the rider until accept, reject, timeout, or cancel.

## Known limitations

- Timeout sweeping runs inside the API process. A process restart can delay expiry until the next sweep.
- Recommendation scoring is a transparent heuristic, not a true routing solver.
- Sessions are HMAC tokens, not a production identity provider with RBAC on every route.
- Sample data is created only when the riders / users / jobs tables are empty.

## Incomplete parts

- No dedicated background worker or message queue.
- No real map distances.
- Dispatcher and rider APIs are not fully locked down by role on every route.

## Three improvements I would make next

1. A scheduled worker for timeout processing, with row-level skip-locked claiming.
2. Geographic service zones with live ETA and route balancing.
3. Role-based authorization on every mutation, plus SLA timers and exports on the dashboard.
