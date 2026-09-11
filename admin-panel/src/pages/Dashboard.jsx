import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api, { setAuthToken } from "../api/client";

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState({
    mostBlocked: [],
    byUser: [],
    byDevice: [],
  });

  const [overview, setAnalyticsOverview] =
  useState({
    total_block_attempts: 0,
    today_block_attempts: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("admin_token");

      if (!token) {
        navigate("/admin/login", {
          replace: true,
        });
        return;
      }

      setAuthToken(token);

      try {
        const [
          dashboardResponse,
          overviewResponse,
          mostBlockedResponse,
          byUserResponse,
          byDeviceResponse,
        ] = await Promise.all([
          api.get("/api/admin/dashboard"),
          api.get("/api/admin/analytics/overview"),
          api.get("/api/admin/analytics/most-blocked"),
          api.get("/api/admin/analytics/by-user"),
          api.get("/api/admin/analytics/by-device"),
        ]);

        setStats(dashboardResponse.data);

        setAnalytics({
          mostBlocked: mostBlockedResponse.data,
          byUser: byUserResponse.data,
          byDevice: byDeviceResponse.data,
        });

        setAnalyticsOverview(
          overviewResponse.data
        );

      } catch (err) {
        console.error(
          "Failed to load dashboard:",
          err
        );

        if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_user");

          setAuthToken(null);

          navigate("/admin/login", {
            replace: true,
          });

          return;
        }

        setError(
          err.response?.data?.detail ||
            "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [navigate]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-muted">
          Loading dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <p className="dashboard-error">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            DeepFocus overview and activity.
          </p>
        </div>
      </div>


      {/* -------------------------------- */}
      {/* PLATFORM STATISTICS */}
      {/* -------------------------------- */}

      <section>
        <h2 className="dashboard-section-title">
          Overview
        </h2>

        <div className="stats-grid">

          <div className="stat-card">
            <span className="stat-card-label">
              Total Users
            </span>

            <strong>
              {stats.total_users}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">
              Active Users
            </span>

            <strong>
              {stats.active_users}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">
              Devices
            </span>

            <strong>
              {stats.total_devices}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">
              Blocked Sites
            </span>

            <strong>
              {stats.total_blocked_sites}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">
              Total Block Attempts
            </span>

            <strong>
              {overview.total_block_attempts}
            </strong>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">
              Today's Block Attempts
            </span>

            <strong>
              {overview.today_block_attempts}
            </strong>
          </div>

        </div>
      </section>


      {/* -------------------------------- */}
      {/* ANALYTICS */}
      {/* -------------------------------- */}

      <section className="analytics-section">

        <h2 className="dashboard-section-title">
          Analytics
        </h2>

        <div className="analytics-grid">

          {/* Most blocked sites */}

          <div className="analytics-card">

            <div className="analytics-card-header">
              <h3>
                Most Blocked Sites
              </h3>
            </div>

            {analytics.mostBlocked.length === 0 ? (
              <div className="empty-state">
                No block attempts yet.
              </div>
            ) : (
              <div className="analytics-list">

                {analytics.mostBlocked
                  .slice(0, 10)
                  .map((item, index) => (
                    <div
                      className="analytics-row"
                      key={item.domain}
                    >
                      <div>
                        <span className="rank">
                          {index + 1}
                        </span>

                        <strong>
                          {item.domain}
                        </strong>
                      </div>

                      <span>
                        {item.attempts}
                      </span>
                    </div>
                  ))}

              </div>
            )}

          </div>


          {/* Attempts by user */}

          <div className="analytics-card">

            <div className="analytics-card-header">
              <h3>
                Attempts by User
              </h3>
            </div>

            {analytics.byUser.length === 0 ? (
              <div className="empty-state">
                No block attempts yet.
              </div>
            ) : (
              <div className="analytics-list">

                {analytics.byUser
                  .slice(0, 10)
                  .map((item) => (
                    <div
                      className="analytics-row"
                      key={item.user_id}
                    >
                      <strong>
                        {item.email}
                      </strong>

                      <span>
                        {item.attempts}
                      </span>
                    </div>
                  ))}

              </div>
            )}

          </div>

        </div>


        {/* Attempts by device */}

        <div className="analytics-card analytics-card-wide">

          <div className="analytics-card-header">
            <h3>
              Attempts by Device
            </h3>
          </div>

          {analytics.byDevice.length === 0 ? (
            <div className="empty-state">
              No block attempts yet.
            </div>
          ) : (
            <div className="analytics-table">

              <div className="analytics-table-header">
                <span>User</span>
                <span>Browser</span>
                <span>OS</span>
                <span>Attempts</span>
              </div>

              {analytics.byDevice
                .slice(0, 20)
                .map((item) => (
                  <div
                    className="analytics-table-row"
                    key={item.device_id}
                  >
                    <span>{item.email}</span>
                    <span>{item.browser}</span>
                    <span>
                      {item.operating_system}
                    </span>
                    <strong>
                      {item.attempts}
                    </strong>
                  </div>
                ))}

            </div>
          )}

        </div>

      </section>

    </div>
  );
}

export default Dashboard;