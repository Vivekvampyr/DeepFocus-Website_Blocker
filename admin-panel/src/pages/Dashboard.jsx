import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api, { setAuthToken } from "../api/client";

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("admin_token");

      if (!token) {
        navigate("/admin/login", { replace: true });
        return;
      }

      setAuthToken(token);

      try {
        const response = await api.get("/api/admin/dashboard");

        setStats(response.data);
      } catch (err) {
        console.error("Failed to load dashboard:", err);

        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_user");
          setAuthToken(null);

          navigate("/admin/login", { replace: true });
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
        <h1>DeepFocus Admin</h1>
        <p className="dashboard-muted">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <h1>DeepFocus Admin</h1>
        <p className="dashboard-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>DeepFocus Admin</h1>
          <p>Overview</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card-label">Total Users</span>
          <strong>{stats.total_users}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Active Users</span>
          <strong>{stats.active_users}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Devices</span>
          <strong>{stats.total_devices}</strong>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Blocked Sites</span>
          <strong>{stats.total_blocked_sites}</strong>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;