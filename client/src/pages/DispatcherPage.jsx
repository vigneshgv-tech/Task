import { useEffect, useState } from "react";
import LoadingButton from "../components/LoadingButton";

export default function DispatcherPage({
  dashboard,
  jobs,
  riders,
  zones,
  selectedJobId,
  setSelectedJobId,
  selectedJobSummary,
  selectedJob,
  selectedJobStatus,
  recommendations,
  activeAction,
  displayName,
  jobForm,
  setJobForm,
  createJob,
  assignRider,
  requestRecommendations,
  confirmAssignment,
  moveToManualQueue,
  timeoutAssignment,
  markStatus,
  timeoutMinutes,
  signOut,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const filteredJobs = jobs.filter((job) => {
    const orderId = String(
      job.order_reference || job.job_reference || "",
    ).toLowerCase();
    const matchesSearch = orderId.includes(searchQuery.trim().toLowerCase());
    const matchesStatus = !statusFilter || job.status === statusFilter;
    const matchesZone =
      !zoneFilter ||
      job.pickup_zone === zoneFilter ||
      job.delivery_zone === zoneFilter;
    return matchesSearch && matchesStatus && matchesZone;
  });
  const attentionJobs = jobs.filter((job) =>
    ["MANUAL_QUEUE", "AWAITING_CONFIRMATION", "NEW"].includes(job.status),
  );
  const manualQueueJobs = jobs.filter((job) => job.status === "MANUAL_QUEUE");
  const canAssignToSelectedJob = [
    "READY_FOR_ASSIGNMENT",
    "MANUAL_QUEUE",
  ].includes(selectedJobStatus);

  useEffect(() => {
    if (!searchQuery && !statusFilter && !zoneFilter) return;
    setSelectedJobId(filteredJobs[0]?.id || null);
  }, [searchQuery, statusFilter, zoneFilter]);

  function openQueueJob(jobId) {
    setSearchQuery("");
    setStatusFilter("");
    setZoneFilter("");
    setSelectedJobId(jobId);
  }

  function assignSelectedRider(riderId, isTopRecommendation) {
    if (!isTopRecommendation && !overrideReason.trim()) {
      setAssignmentError("Enter a reason to override the top recommendation.");
      return;
    }
    setAssignmentError("");
    assignRider(riderId, isTopRecommendation ? "" : overrideReason);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Project <span>RELAY</span>
        </div>
        <div className="session-controls">
          <span>{displayName || "Dispatcher"}</span>
          {/* <span className="timeout-hint">
            Confirm within {timeoutMinutes || 2} min
          </span> */}
          <button className="secondary-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="metrics">
        <Metric label="Total jobs" value={dashboard.summary.total_jobs} />
        <Metric
          label="Awaiting assignment"
          value={dashboard.summary.waiting_assignment}
        />
        <Metric
          label="Awaiting rider confirmation"
          value={dashboard.summary.awaiting_confirmation}
        />
        <Metric label="In progress" value={dashboard.summary.in_progress} />
        <Metric label="Manual queue" value={dashboard.summary.manual_queue} />
        <Metric label="Completed" value={dashboard.summary.completed} />
        <Metric label="Cancelled" value={dashboard.summary.cancelled} />
      </section>

      <section className="panel attention-panel">
        <div className="row">
          <h3>Needs attention</h3>
          <strong>{attentionJobs.length}</strong>
        </div>
        <div className="attention-list">
          {attentionJobs.map((job) => (
            <button
              type="button"
              className="attention-item"
              key={job.id}
              onClick={() => openQueueJob(job.id)}
            >
              <span className={`badge ${statusClass(job.status)}`}>
                {job.status}
              </span>
              <strong>{job.order_reference || job.job_reference}</strong>
              <span>
                {job.pickup_zone} → {job.delivery_zone}
              </span>
            </button>
          ))}
          {attentionJobs.length === 0 && (
            <span className="quiet-state">No jobs need attention.</span>
          )}
        </div>
      </section>

      <div className="main-grid">
        <section className="panel">
          <div className="row">
            <h3>Dispatch dashboard</h3>
          </div>
          <div className="job-filters">
            <input
              aria-label="Search order ID"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search order ID"
            />
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "NEW",
                "READY_FOR_ASSIGNMENT",
                "AWAITING_CONFIRMATION",
                "ACCEPTED",
                "PICKED_UP",
                "MANUAL_QUEUE",
                "DELIVERED",
                "CANCELLED",
              ].map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by service zone"
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
            >
              <option value="">All zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </div>
          <div className="job-list">
            {filteredJobs.map((job) => (
              <button
                type="button"
                key={job.id}
                className={`job-item job-select ${Number(job.id) === Number(selectedJobId) ? "active" : ""}`}
                onClick={() => setSelectedJobId(job.id)}
              >
                <div className="job-header">
                  <strong>{job.job_reference}</strong>
                  <span className={`badge ${statusClass(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="row">
                  <span>
                    {job.pickup_zone} → {job.delivery_zone}
                  </span>
                  <span>{job.priority}</span>
                </div>
                <div className="row">
                  <span>Load {job.load_capacity}</span>
                  <span>
                    {job.assigned_rider_id
                      ? `Rider ${job.assigned_rider_id}`
                      : "Unassigned"}
                  </span>
                </div>
              </button>
            ))}
            {filteredJobs.length === 0 && (
              <p className="empty-state">
                {jobs.length ? "No jobs match these filters." : "No jobs yet."}
              </p>
            )}
          </div>
        </section>

        <aside className="panel">
          <h3>Create job</h3>
          <form onSubmit={createJob} className="form-grid">
            <select
              required
              value={jobForm.pickup_zone}
              onChange={(event) =>
                setJobForm({ ...jobForm, pickup_zone: event.target.value })
              }
            >
              <option value="" disabled>
                Select pickup zone
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
            <select
              required
              value={jobForm.delivery_zone}
              onChange={(event) =>
                setJobForm({ ...jobForm, delivery_zone: event.target.value })
              }
            >
              <option value="" disabled>
                Select delivery zone
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min="1"
              value={jobForm.load_capacity}
              onChange={(event) =>
                setJobForm({
                  ...jobForm,
                  load_capacity: Number(event.target.value),
                })
              }
              placeholder="Delivery load requirement"
            />
            <select
              required
              value={jobForm.priority}
              onChange={(event) =>
                setJobForm({ ...jobForm, priority: event.target.value })
              }
            >
              <option value="" disabled>
                Select priority
              </option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <label>
              Delivery deadline
              <input
                type="datetime-local"
                value={jobForm.deadline || ""}
                onChange={(event) =>
                  setJobForm({ ...jobForm, deadline: event.target.value })
                }
              />
            </label>
            <LoadingButton
              type="submit"
              activeAction={activeAction}
              action="create-job"
              loadingLabel="Creating job..."
              className="primary-btn"
              label="Create delivery job"
            />
          </form>
        </aside>
      </div>

      <section className="panel manual-queue-panel">
        <div className="row">
          <h3>Manual Queue</h3>
          <strong>{manualQueueJobs.length}</strong>
        </div>
        {manualQueueJobs.length > 0 ? (
          <div className="attention-list">
            {manualQueueJobs.map((job) => (
              <button
                type="button"
                className="attention-item"
                key={job.id}
                onClick={() => openQueueJob(job.id)}
              >
                <span className="badge manual">MANUAL QUEUE</span>
                <strong>{job.order_reference || job.job_reference}</strong>
                <span>
                  {job.pickup_zone} → {job.delivery_zone}
                </span>
                <span>
                  {job.assigned_rider_id
                    ? `Last rider ${job.assigned_rider_id}`
                    : "Unassigned"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="quiet-state">
            No jobs are waiting in the Manual Queue.
          </p>
        )}
      </section>

      {selectedJob &&
        Number(selectedJob.id) === Number(selectedJobSummary?.id) && (
          <section className="panel detail-panel">
            <div className="row">
              <h3>{selectedJob.job_reference}</h3>
              <span className={`badge ${statusClass(selectedJob.status)}`}>
                {selectedJob.status}
              </span>
            </div>
            <div className="job-detail-grid">
              <ul className="info-list">
                <li>Pickup: {selectedJob.pickup_zone}</li>
                <li>Delivery: {selectedJob.delivery_zone}</li>
                <li>Load: {selectedJob.load_capacity}</li>
                <li>Priority: {selectedJob.priority}</li>
              </ul>
              <ul className="info-list">
                <li>
                  Assigned rider: {selectedJob.assigned_rider_id || "None"}
                </li>
                <li>Reference: {selectedJob.job_reference}</li>
                <li>
                  Created:{" "}
                  {selectedJob.created_at
                    ? new Date(selectedJob.created_at).toLocaleString()
                    : "Unknown"}
                </li>
                <li>
                  Deadline:{" "}
                  {selectedJob.deadline
                    ? new Date(selectedJob.deadline).toLocaleString()
                    : "None"}
                </li>
                <li>
                  Queue reason: {selectedJob.manual_queue_reason || "None"}
                </li>
              </ul>
            </div>

            <div className="inline-actions">
              {selectedJobStatus &&
                !["DELIVERED", "CANCELLED"].includes(selectedJobStatus) && (
                  <LoadingButton
                    activeAction={activeAction}
                    action="recommendations"
                    loadingLabel="Refreshing riders..."
                    className="secondary-btn"
                    onClick={requestRecommendations}
                    label="Refresh recommendations"
                  />
                )}
              {recommendations.length > 0 && canAssignToSelectedJob && (
                <LoadingButton
                  activeAction={activeAction}
                  action={`assign-${recommendations[0].rider.id}`}
                  loadingLabel="Assigning..."
                  className="primary-btn"
                  onClick={() =>
                    assignSelectedRider(recommendations[0].rider.id, true)
                  }
                  label="Recommend top rider"
                />
              )}
              {selectedJobStatus === "AWAITING_CONFIRMATION" && (
                <>
                  <LoadingButton
                    activeAction={activeAction}
                    action={`confirm-${selectedJob.id}-ACCEPT`}
                    loadingLabel="Accepting..."
                    className="primary-btn"
                    onClick={() => confirmAssignment("ACCEPT")}
                    label="Accept assignment"
                  />
                  <LoadingButton
                    activeAction={activeAction}
                    action={`confirm-${selectedJob.id}-REJECT`}
                    loadingLabel="Rejecting..."
                    className="secondary-btn"
                    onClick={() => confirmAssignment("REJECT")}
                    label="Reject assignment"
                  />
                  <LoadingButton
                    activeAction={activeAction}
                    action="timeout"
                    loadingLabel="Timing out..."
                    className="secondary-btn"
                    onClick={timeoutAssignment}
                    label="Simulate timeout"
                  />
                </>
              )}
              {selectedJobStatus === "READY_FOR_ASSIGNMENT" && (
                <LoadingButton
                  activeAction={activeAction}
                  action="manual-queue"
                  loadingLabel="Moving..."
                  className="secondary-btn"
                  onClick={moveToManualQueue}
                  label="Send to manual queue"
                />
              )}
              {selectedJobStatus === "ACCEPTED" && (
                <LoadingButton
                  activeAction={activeAction}
                  action={`status-PICKED_UP-${selectedJob.id}`}
                  loadingLabel="Updating..."
                  className="primary-btn"
                  onClick={() => markStatus("PICKED_UP")}
                  label="Mark picked up"
                />
              )}
              {selectedJobStatus === "PICKED_UP" && (
                <LoadingButton
                  activeAction={activeAction}
                  action={`status-DELIVERED-${selectedJob.id}`}
                  loadingLabel="Updating..."
                  className="primary-btn"
                  onClick={() => markStatus("DELIVERED")}
                  label="Mark delivered"
                />
              )}
              {!["DELIVERED", "CANCELLED"].includes(selectedJobStatus) && (
                <LoadingButton
                  activeAction={activeAction}
                  action={`status-CANCELLED-${selectedJob.id}`}
                  loadingLabel="Cancelling..."
                  className="danger-btn"
                  onClick={() => markStatus("CANCELLED")}
                  label="Cancel"
                />
              )}
            </div>

            <div className="detail-columns">
              <div>
                <h4>Eligible rider recommendations</h4>
                {recommendations.length > 1 && canAssignToSelectedJob && (
                  <label className="override-reason-field">
                    Override reason (required for another rider)
                    <input
                      value={overrideReason}
                      onChange={(event) => {
                        setOverrideReason(event.target.value);
                        setAssignmentError("");
                      }}
                      placeholder="Why choose someone other than the top recommendation?"
                    />
                  </label>
                )}
                {assignmentError && (
                  <p className="form-message" role="alert">
                    {assignmentError}
                  </p>
                )}
                <div className="recommendation-list">
                  {recommendations.map((entry, index) => (
                    <div className="rider-card" key={entry.rider.id}>
                      <div className="row">
                        <strong>{`#${index + 1} · ${entry.rider.name}`}</strong>
                        {canAssignToSelectedJob && (
                          <LoadingButton
                            activeAction={activeAction}
                            action={`assign-${entry.rider.id}`}
                            loadingLabel="Assigning..."
                            className="primary-btn"
                            onClick={() =>
                              assignSelectedRider(entry.rider.id, index === 0)
                            }
                            label={
                              index === 0
                                ? "Assign recommended"
                                : "Choose and assign"
                            }
                          />
                        )}
                      </div>
                      <div>
                        Score: {Math.round(entry.score)}
                        {entry.travel_minutes
                          ? ` · ~${entry.travel_minutes} min travel`
                          : ""}
                      </div>
                      <ul>
                        {entry.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {recommendations.length === 0 && (
                    <p className="empty-state">
                      No riders currently meet this job&apos;s pickup zone,
                      delivery-zone, availability, capacity, and workload
                      requirements.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h4>Assignment attempts</h4>
                <div className="history-list">
                  {(selectedJob.assignments || []).map((assignment) => (
                    <div className="history-item" key={assignment.id}>
                      <strong>
                        Attempt {assignment.attemptNumber} · {assignment.status}
                      </strong>
                      <div>
                        Rider {assignment.riderId} · assigned{" "}
                        {new Date(
                          assignment.assignedAt || assignment.createdAt,
                        ).toLocaleString()}
                      </div>
                      <small>
                        {assignment.acceptedAt
                          ? `Confirmed ${new Date(assignment.acceptedAt).toLocaleString()}`
                          : ""}
                        {assignment.rejectedAt
                          ? `Rejected ${new Date(assignment.rejectedAt).toLocaleString()}`
                          : ""}
                        {assignment.timedOutAt
                          ? `Timed out ${new Date(assignment.timedOutAt).toLocaleString()}`
                          : ""}
                        {!assignment.acceptedAt &&
                        !assignment.rejectedAt &&
                        !assignment.timedOutAt
                          ? `Confirmation due ${new Date(assignment.responseDeadline).toLocaleString()}`
                          : ""}
                      </small>
                    </div>
                  ))}
                  {(selectedJob.assignments || []).length === 0 && (
                    <span className="quiet-state">
                      No assignment attempts recorded.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <h4>Operational history</h4>
                <div className="history-list">
                  {(selectedJob.history || []).map((event) => (
                    <div className="history-item" key={event.id}>
                      <strong>{event.event_type}</strong>
                      <div>{new Date(event.created_at).toLocaleString()}</div>
                      <small>{event.actor_id || event.actor || "system"}</small>
                      {event.details &&
                        Object.keys(event.details).length > 0 && (
                          <small>
                            {Object.entries(event.details)
                              .map(
                                ([key, value]) =>
                                  `${key.replaceAll("_", " ")}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
                              )
                              .join(" · ")}
                          </small>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

      <section className="panel roster-panel">
        <h3>Rider roster</h3>
        <div className="recommendation-list">
          {riders.map((rider) => (
            <div className="rider-card" key={rider.id}>
              <div className="row">
                <strong>{rider.name}</strong>
                <span
                  className={`badge ${rider.availability === "AVAILABLE" ? "ready" : "manual"}`}
                >
                  {rider.availability}
                </span>
              </div>
              <div>Current zone: {rider.current_zone}</div>
              <div>
                Supported service zones:{" "}
                {rider.supported_zones?.join(", ") || "None"}
              </div>
              <div>
                Capacity: {rider.available_capacity} / {rider.total_capacity}{" "}
                available
              </div>
              <div>Current workload: {rider.current_workload}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <small>{label}</small>
      <strong>{value || 0}</strong>
    </div>
  );
}

function statusClass(status) {
  if (status === "READY_FOR_ASSIGNMENT") return "ready";
  if (status === "MANUAL_QUEUE") return "manual";
  if (status === "AWAITING_CONFIRMATION") return "pending";
  if (status === "DELIVERED") return "delivered";
  return "accepted";
}
