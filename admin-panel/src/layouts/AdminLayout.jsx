import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { setAuthToken } from "../api/client";

function AdminLayout() {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("admin_user") || "null"
  );

  function logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");

    setAuthToken(null);

    navigate("/admin/login", {
      replace: true,
    });
  }

  return (
    <div className="admin-shell">

      <aside className="sidebar">

        <div className="sidebar-brand">
          <h1>DeepFocus</h1>
          <span>Administration</span>
        </div>

        <nav className="sidebar-nav">

          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive
                ? "nav-item active"
                : "nav-item"
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive
                ? "nav-item active"
                : "nav-item"
            }
          >
            Users
          </NavLink>

        </nav>

        <div className="sidebar-footer">

          <div className="admin-info">
            <span>Signed in as</span>
            <strong>
              {user?.email || "Administrator"}
            </strong>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </aside>

      <main className="admin-content">
        <Outlet />
      </main>

    </div>
  );
}

export default AdminLayout;