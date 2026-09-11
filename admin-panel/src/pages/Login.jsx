import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthToken } from "../api/client";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const userStr = localStorage.getItem("admin_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === "ADMIN") {
          navigate("/admin/dashboard", { replace: true });
        }
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const loginResponse = await api.post("/api/auth/login", {
        email: email.trim(),
        password,
      });

      const token = loginResponse.data.access_token;

      // Save token for future requests.
      localStorage.setItem("admin_token", token);

      setAuthToken(token);

      // Verify account identity and role.
      const meResponse = await api.get("/api/auth/me");

      const user = meResponse.data;

      if (user.role !== "ADMIN") {
        localStorage.removeItem("admin_token");
        setAuthToken(null);

        setError("You do not have administrator access.");
        return;
      }

      localStorage.setItem(
        "admin_user",
        JSON.stringify(user)
      );

      navigate("/admin/dashboard", {
        replace: true,
      });

    } catch (err) {
      console.error("Admin login failed:", err);

      let message = "Unable to login. Please check your credentials.";
      const detail = err.response?.data?.detail;

      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail
          .map((d) => (typeof d === "string" ? d : d.msg || JSON.stringify(d)))
          .join(", ");
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      } else if (err.message && !err.response) {
        message = `Unable to connect to backend server at ${api.defaults.baseURL}. Please ensure it is running.`;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <h1>DeepFocus</h1>
          <p>Administration</p>
        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

        </form>

      </div>
    </div>
  );
}

export default Login;