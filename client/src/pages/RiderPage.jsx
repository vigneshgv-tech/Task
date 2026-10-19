import LoadingButton from "../components/LoadingButton";

export default function RiderPage({
  currentRider,
  displayName,
  activeAction,
  showRiderProfile,
  setShowRiderProfile,
  riderProfileDraft,
  setRiderProfileDraft,
  canGoBackToDeliveries,
  backToDeliveries,
  zones,
  saveRiderProfile,
  toggleRiderAvailability,
  riderJobs,
  confirmAssignment,
  markStatus,
  signOut,
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">
            Rider <span>RELAY</span>
          </div>
          <div className="workspace-caption">
            {currentRider?.name || displayName || "Rider workspace"}
            {currentRider?.current_zone && ` · ${currentRider.current_zone}`}
          </div>
        </div>
        <div className="session-controls">
          <button
            className="secondary-btn"
            onClick={() => setShowRiderProfile(true)}
          >
            My profile
          </button>
          {currentRider && (
            <LoadingButton
              activeAction={activeAction}
              action="rider-availability"
              loadingLabel="Updating..."
              className={
                currentRider.availability_status === "AVAILABLE"
                  ? "secondary-btn"
                  : "primary-btn"
              }
              onClick={toggleRiderAvailability}
              label={
                currentRider.availability_status === "AVAILABLE"
                  ? "Go unavailable"
                  : "Go available"
              }
            />
          )}
          <button className="secondary-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {showRiderProfile && currentRider && riderProfileDraft ? (
        <section className="rider-workspace rider-profile-panel">
          <div className="row">
            <div>
              <p className="login-kicker">Rider setup</p>
              <h2>Complete your profile</h2>
            </div>
            <div className="profile-navigation">
              {/* <span className="profile-id">Rider ID {currentRider.id}</span> */}
              {canGoBackToDeliveries && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={backToDeliveries}
                >
                  Back to deliveries
                </button>
              )}
            </div>
          </div>
          <form className="rider-profile-form" onSubmit={saveRiderProfile}>
            <label>
              Name
              <input
                required
                value={riderProfileDraft.name}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Assignment availability
              <select
                value={riderProfileDraft.availability_status}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    availability_status: event.target.value,
                  })
                }
              >
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </label>
            <label>
              Current zone
              <select
                required
                value={riderProfileDraft.current_zone}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    current_zone: event.target.value,
                    supported_zones: riderProfileDraft.supported_zones.filter(
                      (zone) => zone !== event.target.value,
                    ),
                  })
                }
              >
                <option value="" disabled>
                  Select current zone
                </option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Supported service zones
              <select
                required
                multiple
                value={riderProfileDraft.supported_zones}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    supported_zones: Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  })
                }
              >
                {zones.map((zone) => (
                  <option
                    key={zone.id}
                    value={zone.value}
                    disabled={zone.value === riderProfileDraft.current_zone}
                  >
                    {zone.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Defined delivery capacity
              <input
                required
                min="1"
                type="number"
                value={riderProfileDraft.total_capacity}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    total_capacity: event.target.value,
                    available_capacity: String(
                      Math.max(
                        Number(event.target.value) -
                          Number(riderProfileDraft.current_workload),
                        0,
                      ),
                    ),
                  })
                }
              />
            </label>
            <label>
              Available capacity
              <input
                required
                min="0"
                max={Math.max(
                  Number(riderProfileDraft.total_capacity) -
                    Number(riderProfileDraft.current_workload),
                  0,
                )}
                type="number"
                value={riderProfileDraft.available_capacity}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    available_capacity: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Current workload
              <input
                required
                min="0"
                type="number"
                value={riderProfileDraft.current_workload}
                onChange={(event) =>
                  setRiderProfileDraft({
                    ...riderProfileDraft,
                    current_workload: event.target.value,
                    available_capacity: String(
                      Math.max(
                        Number(riderProfileDraft.total_capacity) -
                          Number(event.target.value),
                        0,
                      ),
                    ),
                  })
                }
              />
            </label>
            <LoadingButton
              type="submit"
              activeAction={activeAction}
              action="rider-profile-save"
              loadingLabel="Saving profile..."
              className="primary-btn"
              label="Save profile and continue"
            />
          </form>
        </section>
      ) : (
        <>
          {currentRider && (
            <section
              className="rider-capacity-strip"
              aria-label="Current capacity"
            >
              <div>
                <small>Current workload</small>
                <strong>{currentRider.current_workload}</strong>
              </div>
              <div>
                <small>Available capacity</small>
                <strong>
                  {currentRider.available_capacity} /{" "}
                  {currentRider.total_capacity}
                </strong>
              </div>
            </section>
          )}
          <section className="rider-workspace">
            <div className="row">
              <div>
                <p className="login-kicker">My deliveries</p>
                <h2>{riderJobs.length} assigned</h2>
              </div>
              {currentRider && (
                <span className="badge ready">
                  {currentRider.availability_status}
                </span>
              )}
            </div>
            {riderJobs.length === 0 ? (
              <div className="empty-state">
                No deliveries are assigned right now.
              </div>
            ) : (
              <div className="job-list">
                {riderJobs.map((job) => (
                  <article className="job-item rider-job" key={job.id}>
                    <div className="job-header">
                      <strong>
                        {job.order_reference || job.job_reference}
                      </strong>
                      <span className="badge pending">
                        {job.current_status || job.status}
                      </span>
                    </div>
                    <div className="rider-route">
                      <span>{job.pickup_zone}</span>
                      <span className="route-arrow">→</span>
                      <span>{job.delivery_zone}</span>
                    </div>
                    <div className="row rider-job-meta">
                      <span>Load {job.load_capacity}</span>
                      <span>{job.priority}</span>
                      <span>
                        {job.delivery_deadline || job.deadline
                          ? new Date(
                              job.delivery_deadline || job.deadline,
                            ).toLocaleString()
                          : "No deadline"}
                      </span>
                    </div>
                    <div className="inline-actions">
                      {job.status === "AWAITING_CONFIRMATION" && (
                        <>
                          <LoadingButton
                            activeAction={activeAction}
                            action={`confirm-${job.id}-ACCEPT`}
                            loadingLabel="Accepting..."
                            className="primary-btn"
                            onClick={() => confirmAssignment("ACCEPT", job)}
                            label="Accept delivery"
                          />
                          <LoadingButton
                            activeAction={activeAction}
                            action={`confirm-${job.id}-REJECT`}
                            loadingLabel="Declining..."
                            className="secondary-btn"
                            onClick={() => confirmAssignment("REJECT", job)}
                            label="Decline"
                          />
                        </>
                      )}
                      {job.status === "ACCEPTED" && (
                        <LoadingButton
                          activeAction={activeAction}
                          action={`status-PICKED_UP-${job.id}`}
                          loadingLabel="Updating..."
                          className="primary-btn"
                          onClick={() => markStatus("PICKED_UP", job)}
                          label="Mark picked up"
                        />
                      )}
                      {job.status === "PICKED_UP" && (
                        <LoadingButton
                          activeAction={activeAction}
                          action={`status-DELIVERED-${job.id}`}
                          loadingLabel="Updating..."
                          className="primary-btn"
                          onClick={() => markStatus("DELIVERED", job)}
                          label="Complete delivery"
                        />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
