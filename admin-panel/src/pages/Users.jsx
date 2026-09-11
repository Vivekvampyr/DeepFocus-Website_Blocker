import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api, { setAuthToken } from "../api/client";

function Users() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    const token = localStorage.getItem("admin_token");

    if (!token) {
      navigate("/admin/login", {
        replace: true,
      });

      return;
    }

    setAuthToken(token);

    setLoading(true);
    setError("");

    try {
      let response;

      if (search.trim()) {
        response = await api.get(
          `/api/admin/users/search`,
          {
            params: {
              q: search.trim(),
            },
          }
        );
      } else {
        response = await api.get(
          "/api/admin/users"
        );
      }

      setUsers(response.data);

    } catch (err) {
      console.error(
        "Failed to load users:",
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
          "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [search]);

  return (
    <div className="users-page">

      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>
            Manage DeepFocus accounts and inspect
            their activity.
          </p>
        </div>

        <div className="user-count">
          {users.length} users
        </div>
      </div>

      <div className="users-toolbar">

        <input
          type="search"
          placeholder="Search by email..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

      </div>

      {loading && (
        <p className="dashboard-muted">
          Loading users...
        </p>
      )}

      {error && (
        <p className="dashboard-error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="users-table-wrapper">

          <table className="users-table">

            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Blocking</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>

              {users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() =>
                    navigate(
                      `/admin/users/${user.id}`
                    )
                  }
                >

                  <td>
                    <strong>
                      {user.email}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={
                        user.role === "ADMIN"
                          ? "role admin"
                          : "role user"
                      }
                    >
                      {user.role}
                    </span>
                  </td>

                  <td>
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
                  </td>

                  <td>
                    {user.blocking_enabled
                      ? "Enabled"
                      : "Paused"}
                  </td>

                  <td>
                    {new Date(
                      user.created_at
                    ).toLocaleDateString()}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

          {users.length === 0 && (
            <div className="empty-state">
              No users found.
            </div>
          )}

        </div>
      )}

    </div>
  );
}

export default Users;