import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("admin_token");
  const userStr = localStorage.getItem("admin_user");

  if (!token || !userStr) {
    return <Navigate to="/admin/login" replace />;
  }

  let user = null;
  try {
    user = JSON.parse(userStr);
  } catch {
    user = null;
  }

  if (!user || user.role !== "ADMIN") {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default ProtectedRoute;