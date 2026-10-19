import { useEffect, useMemo, useState } from "react";
import AuthPage from "./pages/AuthPage";
import DispatcherPage from "./pages/DispatcherPage";
import RiderPage from "./pages/RiderPage";

const API_URL = "http://localhost:8000";

export default function App() {
  const [dashboard, setDashboard] = useState({ summary: {}, riders: {} });
  const [jobs, setJobs] = useState([]);
  const [riders, setRiders] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [selectedRole, setSelectedRole] = useState("dispatcher");
  const [authMode, setAuthMode] = useState("login");
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [currentRiderId, setCurrentRiderId] = useState("");
  const [riderProfile, setRiderProfile] = useState(null);
  const [riderProfileDraft, setRiderProfileDraft] = useState(null);
  const [showRiderProfile, setShowRiderProfile] = useState(false);
  const [jobForm, setJobForm] = useState({
    pickup_zone: "",
    delivery_zone: "",
    load_capacity: "",
    priority: "",
    deadline: "",
  });
  const [timeoutMinutes, setTimeoutMinutes] = useState(2);

  const selectedJobSummary = useMemo(
    () => jobs.find((job) => Number(job.id) === Number(selectedJobId)) || null,
    [jobs, selectedJobId],
  );
  const selectedJobStatus =
    selectedJob &&
    selectedJobSummary &&
    Number(selectedJob.id) === Number(selectedJobSummary.id)
      ? selectedJob.status
      : null;
  const riderJobs = jobs.filter(
    (job) => Number(job.assigned_rider_id) === Number(currentRiderId),
  );

  async function refreshData() {
    const [
      dashboardResponse,
      jobsResponse,
      ridersResponse,
      zonesResponse,
      configResponse,
    ] = await Promise.all([
      fetch(`${API_URL}/api/dashboard`),
      fetch(`${API_URL}/api/jobs`),
      fetch(`${API_URL}/api/riders`),
      fetch(`${API_URL}/api/master-records/zone`),
      fetch(`${API_URL}/api/config`),
    ]);
    const [dashboardData, jobsData, ridersData, zonesData, configData] =
      await Promise.all([
        dashboardResponse.json(),
        jobsResponse.json(),
        ridersResponse.json(),
        zonesResponse.json(),
        configResponse.json(),
      ]);
    if (configData.assignment_timeout_minutes) {
      setTimeoutMinutes(configData.assignment_timeout_minutes);
    }
    setDashboard(dashboardData);
    setJobs(jobsData.jobs || []);
    setRiders(ridersData.riders || []);
    setZones(zonesData.records || []);
    if (currentRiderId) {
      const refreshedRider = (ridersData.riders || []).find(
        (rider) => Number(rider.id) === Number(currentRiderId),
      );
      if (refreshedRider) setRiderProfile(refreshedRider);
    }
    setSelectedJobId(
      (currentId) => currentId || jobsData.jobs?.[0]?.id || null,
    );
  }

  async function withAction(action, task) {
    if (activeAction) return;
    setActiveAction(action);
    try {
      await task();
    } catch (error) {
      window.alert(error.message || "Unable to complete this action");
    } finally {
      setActiveAction("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        await refreshData();
        const token = window.localStorage.getItem("relay_session_token");
        if (token) {
          try {
            const response = await fetch(`${API_URL}/api/auth/session`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const data = await response.json();
              await openAccount(data.user);
            } else {
              window.localStorage.removeItem("relay_session_token");
            }
          } catch {
            window.localStorage.removeItem("relay_session_token");
          }
        }
      } catch (error) {
        if (!cancelled)
          setLoadError(error.message || "Unable to connect to the API");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedJobSummary) {
      setSelectedJob(null);
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    setSelectedJob(null);
    setRecommendations([]);
    async function loadSelectedJob() {
      try {
        const [jobResponse, recommendationResponse] = await Promise.all([
          fetch(`${API_URL}/api/jobs/${selectedJobSummary.id}`),
          fetch(`${API_URL}/api/jobs/${selectedJobSummary.id}/recommendations`),
        ]);
        const [jobData, recommendationData] = await Promise.all([
          jobResponse.json(),
          recommendationResponse.json(),
        ]);
        if (cancelled) return;
        setSelectedJob({
          ...(jobData.job || {}),
          history: jobData.history || [],
          assignments: jobData.assignments || [],
        });
        setRecommendations(recommendationData.recommendations || []);
      } catch (error) {
        if (!cancelled) console.error("Unable to load selected job", error);
      }
    }
    loadSelectedJob();
    return () => {
      cancelled = true;
    };
  }, [selectedJobSummary]);

  async function retryInitialLoad() {
    setLoading(true);
    setLoadError("");
    try {
      await refreshData();
    } catch (error) {
      setLoadError(error.message || "Unable to connect to the API");
    } finally {
      setLoading(false);
    }
  }

  async function enterWorkspace(event) {
    event.preventDefault();
    setAuthError("");
    await withAction("auth", async () => {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: accountEmail,
          password: accountPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || "Invalid email or password");
        return;
      }
      await openAccount(data.user);
      window.localStorage.setItem("relay_session_token", data.token);
    });
  }

  async function createAccount(event) {
    event.preventDefault();
    setAuthError("");
    await withAction("auth", async () => {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          email: accountEmail,
          password: accountPassword,
          role: selectedRole,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.message || "Unable to create account");
        return;
      }
      await openAccount(data.user);
      window.localStorage.setItem("relay_session_token", data.token);
      await refreshData();
    });
  }

  async function openAccount(user) {
    setDisplayName(user.name);
    setSelectedRole(user.role);
    if (user.role === "rider") {
      const response = await fetch(`${API_URL}/api/riders/${user.rider_id}`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Rider profile not found");
      setRiderProfile(data.rider);
      setRiderProfileDraft({
        name: data.rider.name || "",
        availability_status: data.rider.availability_status || "AVAILABLE",
        current_zone: data.rider.current_zone || "",
        supported_zones: (data.rider.supported_zones || []).filter(
          (zone) => zone !== data.rider.current_zone,
        ),
        total_capacity: data.rider.total_capacity ?? "",
        available_capacity: data.rider.available_capacity ?? "",
        current_workload: data.rider.current_workload ?? 0,
      });
      setCurrentRiderId(String(data.rider.id));
      const profileComplete =
        Boolean(data.rider.current_zone) &&
        data.rider.supported_zones?.length > 0 &&
        Number(data.rider.total_capacity) > 0 &&
        Number(data.rider.available_capacity) >= 0;
      setShowRiderProfile(!profileComplete);
    } else {
      setCurrentRiderId("");
      setRiderProfile(null);
      setShowRiderProfile(false);
    }
    setSignedIn(true);
  }

  async function saveRiderProfile(event) {
    event.preventDefault();
    if (!riderProfile || !riderProfileDraft) return;
    await withAction("rider-profile-save", async () => {
      const response = await fetch(`${API_URL}/api/riders/${riderProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...riderProfileDraft,
          total_capacity: Number(riderProfileDraft.total_capacity),
          available_capacity: Number(riderProfileDraft.available_capacity),
          current_workload: Number(riderProfileDraft.current_workload),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to save profile");
      setRiderProfile(data.rider);
      setShowRiderProfile(false);
      await refreshData();
    });
  }

  function backToRiderDeliveries() {
    if (!riderProfile) return;
    setRiderProfileDraft({
      name: riderProfile.name || "",
      availability_status: riderProfile.availability_status || "AVAILABLE",
      current_zone: riderProfile.current_zone || "",
      supported_zones: (riderProfile.supported_zones || []).filter(
        (zone) => zone !== riderProfile.current_zone,
      ),
      total_capacity: riderProfile.total_capacity ?? "",
      available_capacity: riderProfile.available_capacity ?? "",
      current_workload: riderProfile.current_workload ?? 0,
    });
    setShowRiderProfile(false);
  }

  function signOut() {
    window.localStorage.removeItem("relay_session_token");
    setSignedIn(false);
    setCurrentRiderId("");
    setRiderProfile(null);
    setRiderProfileDraft(null);
    setShowRiderProfile(false);
  }

  async function createJob(event) {
    event.preventDefault();
    await withAction("create-job", async () => {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...jobForm,
          deadline: jobForm.deadline
            ? new Date(jobForm.deadline).toISOString()
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create job");
      setSelectedJobId(data.job.id);
      setJobForm({
        pickup_zone: "",
        delivery_zone: "",
        load_capacity: "",
        priority: "",
        deadline: "",
      });
      await refreshData();
    });
  }

  async function assignRider(riderId, overrideReason = "") {
    if (!selectedJobSummary || !riderId) return;
    await withAction(`assign-${riderId}`, async () => {
      const response = await fetch(
        `${API_URL}/api/jobs/${selectedJobSummary.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rider_id: riderId,
            actor: displayName || "dispatcher",
            override_reason:
              overrideReason.trim() || "Recommended rider assignment",
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Assignment failed");
      await refreshData();
    });
  }

  async function requestRecommendations() {
    if (!selectedJobSummary) return;
    await withAction("recommendations", async () => {
      const response = await fetch(
        `${API_URL}/api/jobs/${selectedJobSummary.id}/recommendations`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to load recommendations");
      setRecommendations(data.recommendations || []);
    });
  }

  async function toggleRiderAvailability() {
    if (!riderProfile) return;
    const nextAvailability =
      riderProfile.availability_status === "AVAILABLE"
        ? "UNAVAILABLE"
        : "AVAILABLE";
    await withAction("rider-availability", async () => {
      const response = await fetch(`${API_URL}/api/riders/${riderProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_status: nextAvailability }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Unable to update availability");
      setRiderProfile(data.rider);
      await refreshData();
    });
  }

  async function confirmAssignment(action, job = selectedJobSummary) {
    if (!job) return;
    await withAction(`confirm-${job.id}-${action}`, async () => {
      const response = await fetch(`${API_URL}/api/jobs/${job.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actor: displayName || "rider" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Confirmation failed");
      await refreshData();
    });
  }

  async function moveToManualQueue() {
    if (!selectedJobSummary) return;
    await withAction("manual-queue", async () => {
      const response = await fetch(
        `${API_URL}/api/jobs/${selectedJobSummary.id}/manual-queue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Dispatcher review required",
            actor: displayName || "dispatcher",
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to queue job");
      await refreshData();
    });
  }

  async function markStatus(status, job = selectedJobSummary) {
    if (!job) return;
    await withAction(`status-${status}-${job.id}`, async () => {
      const response = await fetch(`${API_URL}/api/jobs/${job.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor: displayName || "dispatcher" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Status update failed");
      if (data.job) {
        setJobs((currentJobs) =>
          currentJobs.map((currentJob) =>
            Number(currentJob.id) === Number(data.job.id)
              ? { ...currentJob, ...data.job }
              : currentJob,
          ),
        );
        setSelectedJob((currentJob) =>
          currentJob && Number(currentJob.id) === Number(data.job.id)
            ? { ...currentJob, ...data.job }
            : currentJob,
        );
      }
      if (data.rider && Number(data.rider.id) === Number(currentRiderId)) {
        setRiderProfile(data.rider);
      }
      refreshData().catch((error) =>
        console.error("Background dashboard refresh failed", error),
      );
    });
  }

  async function timeoutAssignment() {
    if (!selectedJobSummary) return;
    await withAction("timeout", async () => {
      const response = await fetch(
        `${API_URL}/api/jobs/${selectedJobSummary.id}/timeout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actor: "system" }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Timeout failed");
      await refreshData();
    });
  }

  if (loading)
    return (
      <div className="app-shell">
        <h2>Loading RELAY dashboard...</h2>
      </div>
    );

  if (loadError) {
    return (
      <main className="login-shell">
        <section className="login-panel" role="alert">
          <div className="brand login-brand">
            Project <span>RELAY</span>
          </div>
          <h2>Unable to load the workspace</h2>
          <p className="form-message">{loadError}</p>
          <button
            className="primary-btn login-submit"
            onClick={retryInitialLoad}
          >
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <AuthPage
        authMode={authMode}
        setAuthMode={setAuthMode}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        displayName={displayName}
        setDisplayName={setDisplayName}
        accountEmail={accountEmail}
        setAccountEmail={setAccountEmail}
        accountPassword={accountPassword}
        setAccountPassword={setAccountPassword}
        authError={authError}
        activeAction={activeAction}
        enterWorkspace={enterWorkspace}
        createAccount={createAccount}
      />
    );
  }

  if (selectedRole === "rider") {
    return (
      <RiderPage
        currentRider={riderProfile}
        displayName={displayName}
        activeAction={activeAction}
        showRiderProfile={showRiderProfile}
        setShowRiderProfile={setShowRiderProfile}
        riderProfileDraft={riderProfileDraft}
        setRiderProfileDraft={setRiderProfileDraft}
        canGoBackToDeliveries={Boolean(
          riderProfile?.current_zone &&
          riderProfile.supported_zones?.length > 0 &&
          Number(riderProfile.total_capacity) > 0,
        )}
        backToDeliveries={backToRiderDeliveries}
        zones={zones}
        saveRiderProfile={saveRiderProfile}
        toggleRiderAvailability={toggleRiderAvailability}
        riderJobs={riderJobs}
        confirmAssignment={confirmAssignment}
        markStatus={markStatus}
        signOut={signOut}
      />
    );
  }

  return (
    <DispatcherPage
      dashboard={dashboard}
      jobs={jobs}
      riders={riders}
      zones={zones}
      selectedJobId={selectedJobId}
      setSelectedJobId={setSelectedJobId}
      selectedJobSummary={selectedJobSummary}
      selectedJob={selectedJob}
      selectedJobStatus={selectedJobStatus}
      recommendations={recommendations}
      activeAction={activeAction}
      displayName={displayName}
      jobForm={jobForm}
      setJobForm={setJobForm}
      createJob={createJob}
      assignRider={assignRider}
      requestRecommendations={requestRecommendations}
      confirmAssignment={confirmAssignment}
      moveToManualQueue={moveToManualQueue}
      timeoutAssignment={timeoutAssignment}
      markStatus={markStatus}
      timeoutMinutes={timeoutMinutes}
      signOut={signOut}
    />
  );
}
