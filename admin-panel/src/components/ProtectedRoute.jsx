import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  const user = localStorage.getItem("admin_user");

  if (!token || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  try {
    const parsedUser = JSON.parse(user);

    if (parsedUser.role !== "ADMIN") {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");

      return <Navigate to="/admin/login" replace />;
    }
  } catch {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");

    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;