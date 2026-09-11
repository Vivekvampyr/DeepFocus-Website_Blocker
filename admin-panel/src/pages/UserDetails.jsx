import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import api, { setAuthToken } from "../api/client";

function UserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function loadUser() {
    const token = localStorage.getItem("admin_token");

    if (!token) {
      navigate("/admin/login", {
        replace: true,
      });
      return;
    }

    setAuthToken(token);

    try {
      const response = await api.get(
        `/api/admin/users/${userId}`
      );

      setData(response.data);
    } catch (err) {
      console.error(
        "Failed to load user:",
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
          "Unable to load user details."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserStatus() {
    if (!data?.user) {
      return;
    }

    const token = localStorage.getItem("admin_token");

    if (!token) {
      navigate("/admin/login", {
        replace: true,
      });
      return;
    }

    setAuthToken(token);
    setUpdatingStatus(true);
    setError("");

    try {
      const response = await api.patch(
        `/api/admin/users/${userId}/status`,
        {
          is_active: !data.user.is_active,
        }
      );

      setData((previous) => ({
        ...previous,
        user: {
          ...previous.user,
          is_active: response.data.is_active,
        },
      }));
    } catch (err) {
      console.error(
        "Failed to update user status:",
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
          "Unable to update user status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function removeBlockedSite(siteId) {
    const token = localStorage.getItem(
      "admin_token"
    );

    if (!token) {
      navigate("/admin/login", {
        replace: true,
      });

      return;
    }

    setAuthToken(token);

    try {
      await api.delete(
        `/api/admin/users/${userId}/sites/${siteId}`
      );

      // Remove the site from the current UI.
      setData((previous) => ({
        ...previous,
        blocked_sites:
          previous.blocked_sites.filter(
            (site) => site.id !== siteId
          ),
        user: {
          ...previous.user,
          sync_version:
            previous.user.sync_version + 1,
        },
      }));

    } catch (err) {
      console.error(
        "Failed to remove blocked site:",
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem(
          "admin_token"
        );

        localStorage.removeItem(
          "admin_user"
        );

        setAuthToken(null);

        navigate("/admin/login", {
          replace: true,
        });

        return;
      }

      setError(
        err.response?.data?.detail ||
          "Unable to remove blocked site."
      );
    }
  }

  useEffect(() => {
    loadUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="user-details-page">
        <p className="dashboard-muted">
          Loading user...
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="user-details-page">
        <p className="dashboard-error">
          {error}
        </p>
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="user-details-page">
        <p className="dashboard-error">
          User data is unavailable.
        </p>
      </div>
    );
  }

  const user = data.user;

  return (
    <div className="user-details-page">

      <button
        type="button"
        className="back-link"
        onClick={() =>
          navigate("/admin/users")
        }
      >
        ← Back to Users
      </button>

      <div className="page-header">

        <div>
          <h1>{user.email}</h1>
          <p>User ID: {user.id}</p>
        </div>

        <div className="user-actions">

          <span
            className={
              user.is_active
                ? "status active"
                : "status inactive"
            }
          >
            {user.is_active
              ? "Active"
              : "Inactive"}
          </span>

          <button
            type="button"
            className={
              user.is_active
                ? "status-button danger"
                : "status-button"
            }
            onClick={toggleUserStatus}
            disabled={updatingStatus}
          >
            {updatingStatus
              ? "Updating..."
              : user.is_active
                ? "Deactivate"
                : "Activate"}
          </button>

        </div>
      </div>

      {error && (
        <p className="dashboard-error">
          {error}
        </p>
      )}

      <section className="details-grid">

        <div className="details-card">
          <span>Role</span>
          <strong>{user.role}</strong>
        </div>

        <div className="details-card">
          <span>Blocking</span>
          <strong>
            {user.blocking_enabled
              ? "Enabled"
              : "Paused"}
          </strong>
        </div>

        <div className="details-card">
          <span>Blocked Sites</span>
          <strong>
            {data.blocked_sites.length}
          </strong>
        </div>

        <div className="details-card">
          <span>Devices</span>
          <strong>
            {data.devices.length}
          </strong>
        </div>

        <div className="details-card">
          <span>Sync Version</span>
          <strong>
            {user.sync_version}
          </strong>
        </div>

        <div className="details-card">
          <span>Created</span>
          <strong>
            {new Date(
              user.created_at
            ).toLocaleDateString()}
          </strong>
        </div>

      </section>

      <section className="details-section">

        <div className="section-heading">
          <h2>Blocked Sites</h2>

          <span>
            {data.blocked_sites.length}
          </span>
        </div>

        <div className="details-list">

          {data.blocked_sites.length === 0 ? (
            <div className="empty-state">
              No blocked sites.
            </div>
          ) : (
            data.blocked_sites.map((site) => (
              <div
                className="detail-row"
                key={site.id}
              >
                <div>
                  <strong>{site.domain}</strong>

                  <span>
                    Added{" "}
                    {new Date(
                      site.created_at
                    ).toLocaleDateString()}
                  </span>
                </div>

                <button
                  type="button"
                  className="site-remove-button"
                  onClick={() =>
                    removeBlockedSite(site.id)
                  }
                >
                  Remove
                </button>
              </div>
            ))
          )}

        </div>

      </section>

      <section className="details-section">

        <div className="section-heading">
          <h2>Devices</h2>

          <span>
            {data.devices.length}
          </span>
        </div>

        <div className="details-list">

          {data.devices.length === 0 ? (
            <div className="empty-state">
              No registered devices.
            </div>
          ) : (
            data.devices.map((device) => (
              <div
                className="detail-row"
                key={device.id}
              >
                <div>
                  <strong>
                    {device.browser}
                  </strong>

                  <span>
                    {device.operating_system}
                  </span>
                </div>

                <div className="device-meta">
                  <span>
                    Extension{" "}
                    {device.extension_version}
                  </span>

                  <span>
                    Last seen{" "}
                    {new Date(
                      device.last_seen
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}

        </div>

      </section>

    </div>
  );
}

export default UserDetails;